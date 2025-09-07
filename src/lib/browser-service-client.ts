/**
 * 외부 브라우저 서비스 클라이언트
 * Vercel 서버리스 제한을 우회하기 위한 전용 브라우저 서비스
 */

interface BrowserServiceConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
}

interface CaptureRequest {
  url: string
  options?: {
    viewport?: { width: number; height: number }
    waitTime?: number
    fullPage?: boolean
    quality?: number
  }
}

interface CaptureResponse {
  success: boolean
  data?: {
    screenshot: string // base64
    metadata: {
      title: string
      url: string
      timestamp: string
      viewport: { width: number; height: number }
    }
  }
  error?: string
}

class BrowserServiceClient {
  private config: BrowserServiceConfig

  constructor(config: BrowserServiceConfig) {
    this.config = {
      timeout: 30000,
      ...config
    }
  }

  async captureScreenshot(request: CaptureRequest): Promise<CaptureResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout!)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[BrowserServiceClient] 캡처 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  async captureFlow(request: {
    url: string
    maxSteps?: number
    triggerKeywords?: string[]
    waitTime?: number
  }): Promise<{
    success: boolean
    data?: {
      screenshots: Array<{
        step: number
        title: string
        url: string
        screenshot: string
      }>
      totalSteps: number
    }
    error?: string
  }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/flow-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000) // 플로우 캡처는 더 긴 타임아웃
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[BrowserServiceClient] 플로우 캡처 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// 환경별 설정
const getBrowserServiceConfig = (): BrowserServiceConfig => {
  // Railway 브라우저 서비스 URL
  const railwayServiceUrl = process.env.RAILWAY_BROWSER_SERVICE_URL
  
  // Docker 로컬 서비스 URL
  const dockerServiceUrl = process.env.DOCKER_BROWSER_SERVICE_URL || 'http://localhost:3001'
  
  // API 키
  const apiKey = process.env.BROWSER_SERVICE_API_KEY
  
  console.log('[BrowserServiceClient] 설정 로드:', {
    hasRailwayUrl: !!railwayServiceUrl,
    hasDockerUrl: !!dockerServiceUrl,
    hasApiKey: !!apiKey,
    nodeEnv: process.env.NODE_ENV
  })
  
  // 개발 환경에서는 Docker 서비스 우선 사용
  if (process.env.NODE_ENV === 'development') {
    return {
      baseUrl: dockerServiceUrl,
      apiKey,
      timeout: 60000
    }
  }
  
  // 프로덕션에서는 Railway 서비스 사용 (fallback: Docker)
  const baseUrl = railwayServiceUrl || dockerServiceUrl
  
  if (!baseUrl) {
    console.warn('[BrowserServiceClient] 브라우저 서비스 URL이 설정되지 않았습니다')
  }
  
  return {
    baseUrl,
    apiKey,
    timeout: 60000
  }
}

// 싱글톤 인스턴스
export const browserServiceClient = new BrowserServiceClient(getBrowserServiceConfig())

// 헬퍼 함수들
export const browserService = {
  // 단일 스크린샷 캡처
  async captureScreenshot(url: string, options?: CaptureRequest['options']) {
    return browserServiceClient.captureScreenshot({ url, options })
  },

  // 플로우 캡처
  async captureFlow(url: string, options?: {
    maxSteps?: number
    triggerKeywords?: string[]
    waitTime?: number
  }) {
    return browserServiceClient.captureFlow({ url, ...options })
  },

  // 서비스 상태 확인
  async isHealthy() {
    return browserServiceClient.healthCheck()
  },

  // 배치 캡처 (여러 URL)
  async captureBatch(urls: string[], options?: CaptureRequest['options']) {
    const results = await Promise.allSettled(
      urls.map(url => browserServiceClient.captureScreenshot({ url, options }))
    )

    return results.map((result, index) => ({
      url: urls[index],
      success: result.status === 'fulfilled' && result.value.success,
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' 
        ? result.reason.message 
        : result.status === 'fulfilled' && !result.value.success 
          ? result.value.error 
          : null
    }))
  }
}

export default browserServiceClient
