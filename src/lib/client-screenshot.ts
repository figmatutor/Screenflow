// 클라이언트 사이드 스크린샷 대안들

/**
 * HTML2Canvas를 사용한 DOM 스크린샷
 */
export async function captureWithHtml2Canvas(element: HTMLElement, options: any = {}) {
  const html2canvas = await import('html2canvas')
  
  const canvas = await html2canvas.default(element, {
    allowTaint: true,
    useCORS: true,
    scale: options.scale || 1,
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor || null,
    ...options
  })

  return canvas.toDataURL('image/png', options.quality || 0.9)
}

/**
 * 외부 URL 스크린샷 서비스 호출
 */
export async function captureExternalUrl(url: string, options: any = {}) {
  const services = [
    {
      name: 'screenshotapi',
      endpoint: 'https://shot.screenshotapi.net/screenshot',
      params: {
        token: process.env.NEXT_PUBLIC_SCREENSHOT_API_TOKEN,
        url,
        width: options.width || 1920,
        height: options.height || 1080,
        output: 'json',
        file_type: options.format || 'png',
        wait_for_event: 'load'
      }
    },
    {
      name: 'urlbox',
      endpoint: 'https://api.urlbox.io/v1/render/png',
      params: {
        token: process.env.NEXT_PUBLIC_URLBOX_TOKEN,
        url,
        width: options.width || 1920,
        height: options.height || 1080,
        full_page: options.fullPage || false
      }
    }
  ]

  for (const service of services) {
    try {
      const queryParams = new URLSearchParams(service.params).toString()
      const response = await fetch(`${service.endpoint}?${queryParams}`)
      
      if (response.ok) {
        if (service.name === 'screenshotapi') {
          const result = await response.json()
          return result.screenshot
        } else {
          const blob = await response.blob()
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
        }
      }
    } catch (error) {
      console.warn(`${service.name} failed:`, error)
      continue
    }
  }

  throw new Error('All screenshot services failed')
}

/**
 * 프록시를 통한 iframe 스크린샷
 */
export async function captureWithProxy(url: string, options: any = {}) {
  // 자체 API 엔드포인트 호출
  const response = await fetch('/api/screenshot-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      options
    })
  })

  if (!response.ok) {
    throw new Error(`Proxy screenshot failed: ${response.statusText}`)
  }

  const result = await response.json()
  return result.screenshot
}

/**
 * WebRTC Screen Capture (사용자 권한 필요)
 */
export async function captureScreen(options: any = {}) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        mediaSource: 'screen',
        width: options.width || 1920,
        height: options.height || 1080
      }
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.play()

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        
        stream.getTracks().forEach(track => track.stop())
        
        resolve(canvas.toDataURL('image/png'))
      }
      
      video.onerror = reject
    })
  } catch (error) {
    throw new Error(`Screen capture failed: ${error.message}`)
  }
}
