import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// 외부 스크린샷 서비스 사용 (Browserless, ScrapingBee 등)
const BROWSERLESS_TOKEN = Deno.env.get('BROWSERLESS_TOKEN')
const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, options = {}, service = 'browserless' } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let screenshot: string
    let metadata: any = { url, timestamp: new Date().toISOString() }

    if (service === 'browserless' && BROWSERLESS_TOKEN) {
      // Browserless.io 사용
      screenshot = await captureWithBrowserless(url, options)
      metadata.service = 'browserless'
    } else if (service === 'scrapingbee' && SCRAPINGBEE_API_KEY) {
      // ScrapingBee 사용
      screenshot = await captureWithScrapingBee(url, options)
      metadata.service = 'scrapingbee'
    } else {
      // Puppeteer 대안: htmlcsstoimage.com API
      screenshot = await captureWithHtmlCssToImage(url, options)
      metadata.service = 'htmlcsstoimage'
    }

    return new Response(
      JSON.stringify({
        success: true,
        screenshot,
        metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Screenshot service error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Screenshot capture failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function captureWithBrowserless(url: string, options: any): Promise<string> {
  const browserlessUrl = `https://chrome.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`
  
  const response = await fetch(browserlessUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      options: {
        fullPage: options.fullPage || false,
        type: options.format || 'png',
        quality: options.quality || 90,
        viewport: {
          width: options.width || 1920,
          height: options.height || 1080,
          deviceScaleFactor: options.deviceScaleFactor || 1
        },
        waitUntil: options.waitUntil || 'networkidle2'
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Browserless API error: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  return `data:image/${options.format || 'png'};base64,${base64}`
}

async function captureWithScrapingBee(url: string, options: any): Promise<string> {
  const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/screenshot')
  scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY!)
  scrapingBeeUrl.searchParams.set('url', url)
  scrapingBeeUrl.searchParams.set('width', (options.width || 1920).toString())
  scrapingBeeUrl.searchParams.set('height', (options.height || 1080).toString())
  scrapingBeeUrl.searchParams.set('full_page', (options.fullPage || false).toString())

  const response = await fetch(scrapingBeeUrl.toString())

  if (!response.ok) {
    throw new Error(`ScrapingBee API error: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  return `data:image/png;base64,${base64}`
}

async function captureWithHtmlCssToImage(url: string, options: any): Promise<string> {
  // htmlcsstoimage.com 무료 대안
  const apiUrl = 'https://hcti.io/v1/image'
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      viewport_width: options.width || 1920,
      viewport_height: options.height || 1080,
      device_scale: options.deviceScaleFactor || 1
    })
  })

  if (!response.ok) {
    throw new Error(`HCTI API error: ${response.statusText}`)
  }

  const result = await response.json()
  return result.url // 이미지 URL 반환
}
