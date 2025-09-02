import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// Playwright for Deno (Docker 환경용)
import { chromium } from "https://deno.land/x/playwright@1.40.0/mod.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, options = {} } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Docker 환경에서 Chromium 실행
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    })

    const context = await browser.newContext({
      viewport: {
        width: options.width || 1920,
        height: options.height || 1080
      },
      deviceScaleFactor: options.deviceScaleFactor || 1
    })

    const page = await context.newPage()

    // 페이지 로드
    await page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000
    })

    // 추가 대기
    if (options.delay) {
      await page.waitForTimeout(options.delay)
    }

    // 특정 요소 대기
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector)
    }

    // 스크린샷 캡처
    const screenshot = await page.screenshot({
      type: options.format || 'png',
      quality: options.quality || 90,
      fullPage: options.fullPage || false
    })

    await browser.close()

    // Base64로 인코딩
    const base64 = btoa(String.fromCharCode(...screenshot))

    return new Response(
      JSON.stringify({
        success: true,
        screenshot: `data:image/${options.format || 'png'};base64,${base64}`,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          options,
          engine: 'playwright-chromium'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Playwright capture error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Screenshot capture failed', 
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
