import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// Puppeteer for Deno
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, options = {} } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Puppeteer 브라우저 실행 (Deno 환경용)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      // Deno에서 Chromium 경로 지정
      executablePath: '/usr/bin/chromium-browser'
    })

    const page = await browser.newPage()
    
    // 뷰포트 설정
    await page.setViewport({
      width: options.width || 1920,
      height: options.height || 1080,
      deviceScaleFactor: options.deviceScaleFactor || 1
    })

    // 페이지 로드
    await page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle2',
      timeout: options.timeout || 30000
    })

    // 추가 대기 시간
    if (options.delay) {
      await page.waitForTimeout(options.delay)
    }

    // 스크린샷 캡처
    const screenshot = await page.screenshot({
      type: options.format || 'png',
      quality: options.quality || 90,
      fullPage: options.fullPage || false,
      encoding: 'base64'
    })

    await browser.close()

    return new Response(
      JSON.stringify({
        success: true,
        screenshot: `data:image/${options.format || 'png'};base64,${screenshot}`,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          options
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Browser capture error:', error)
    
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
