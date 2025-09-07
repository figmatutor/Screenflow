import { NextRequest, NextResponse } from 'next/server'
import { browserService } from '@/lib/browser-service-client'
import { supabaseUtils } from '@/lib/supabase'

interface HybridCaptureRequest {
  url: string
  type: 'screenshot' | 'flow' | 'batch'
  options?: {
    viewport?: { width: number; height: number }
    waitTime?: number
    fullPage?: boolean
    maxSteps?: number
    triggerKeywords?: string[]
    urls?: string[] // batch용
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: HybridCaptureRequest = await request.json()
    const { url, type, options = {} } = body

    console.log(`[Hybrid Capture] ${type} 캡처 시작: ${url}`)

    // 사용자 인증 확인
    const user = await supabaseUtils.getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 브라우저 서비스 상태 확인
    const isServiceHealthy = await browserService.isHealthy()
    if (!isServiceHealthy) {
      console.warn('[Hybrid Capture] 외부 브라우저 서비스 사용 불가, 로컬 처리로 fallback')
      return await handleLocalCapture(body, user.id)
    }

    // 캡처 타입별 처리
    let result
    switch (type) {
      case 'screenshot':
        result = await browserService.captureScreenshot(url, {
          viewport: options.viewport,
          waitTime: options.waitTime,
          fullPage: options.fullPage
        })
        break

      case 'flow':
        result = await browserService.captureFlow(url, {
          maxSteps: options.maxSteps,
          triggerKeywords: options.triggerKeywords,
          waitTime: options.waitTime
        })
        break

      case 'batch':
        if (!options.urls || !Array.isArray(options.urls)) {
          return NextResponse.json(
            { error: 'batch 타입에는 urls 배열이 필요합니다.' },
            { status: 400 }
          )
        }
        result = await browserService.captureBatch(options.urls, {
          viewport: options.viewport,
          waitTime: options.waitTime,
          fullPage: options.fullPage
        })
        break

      default:
        return NextResponse.json(
          { error: '지원하지 않는 캡처 타입입니다.' },
          { status: 400 }
        )
    }

    if (!result.success) {
      console.error('[Hybrid Capture] 캡처 실패:', result.error)
      return NextResponse.json(
        { error: result.error || '캡처 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 결과를 데이터베이스에 저장
    const captureRecord = await supabaseUtils.createCapture({
      user_id: user.id,
      url,
      title: type === 'screenshot' 
        ? result.data?.metadata?.title || '스크린샷'
        : type === 'flow'
          ? `플로우 캡처 (${result.data?.totalSteps || 0}단계)`
          : `배치 캡처 (${options.urls?.length || 0}개)`,
      description: `${type} 캡처 결과`,
      status: 'completed',
      metadata: {
        captureType: type,
        timestamp: new Date().toISOString(),
        service: 'external-browser-service',
        ...result.data
      }
    })

    console.log(`[Hybrid Capture] 캡처 완료 및 DB 저장: ${captureRecord.data?.id}`)

    return NextResponse.json({
      success: true,
      captureId: captureRecord.data?.id,
      type,
      data: result.data,
      message: '캡처가 성공적으로 완료되었습니다.'
    })

  } catch (error) {
    console.error('[Hybrid Capture] 오류:', error)
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}

// 로컬 처리 fallback (기존 Vercel 서버리스 로직)
async function handleLocalCapture(request: HybridCaptureRequest, userId: string) {
  console.log('[Hybrid Capture] 로컬 처리 모드')
  
  // 간단한 스크린샷만 로컬에서 처리 (복잡한 작업은 에러 반환)
  if (request.type !== 'screenshot') {
    return NextResponse.json(
      { 
        error: '외부 브라우저 서비스를 사용할 수 없어 복잡한 캡처는 현재 처리할 수 없습니다.',
        suggestion: '잠시 후 다시 시도해주세요.'
      },
      { status: 503 }
    )
  }

  try {
    // 기존 Vercel 서버리스 로직 사용
    const puppeteer = await import('puppeteer')
    const chromium = await import('@sparticuz/chromium')

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
      timeout: 30000
    })

    const page = await browser.newPage()
    await page.setViewport(request.options?.viewport || { width: 1440, height: 900 })
    
    await page.goto(request.url, { waitUntil: 'networkidle0', timeout: 30000 })
    
    if (request.options?.waitTime) {
      await page.waitForTimeout(request.options.waitTime)
    }

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: request.options?.fullPage || false,
      encoding: 'base64'
    })

    const title = await page.title()
    await browser.close()

    // DB에 저장
    const captureRecord = await supabaseUtils.createCapture({
      user_id: userId,
      url: request.url,
      title: title || '스크린샷',
      description: '로컬 처리 스크린샷',
      status: 'completed',
      metadata: {
        captureType: 'screenshot',
        timestamp: new Date().toISOString(),
        service: 'local-serverless',
        viewport: request.options?.viewport || { width: 1440, height: 900 }
      }
    })

    return NextResponse.json({
      success: true,
      captureId: captureRecord.data?.id,
      type: 'screenshot',
      data: {
        screenshot,
        metadata: {
          title,
          url: request.url,
          timestamp: new Date().toISOString(),
          viewport: request.options?.viewport || { width: 1440, height: 900 }
        }
      },
      message: '로컬에서 캡처가 완료되었습니다.',
      warning: '외부 브라우저 서비스를 사용할 수 없어 기본 기능만 제공됩니다.'
    })

  } catch (error) {
    console.error('[Hybrid Capture] 로컬 처리 실패:', error)
    return NextResponse.json(
      { 
        error: '로컬 캡처 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // 서비스 상태 확인 엔드포인트
  const isHealthy = await browserService.isHealthy()
  
  return NextResponse.json({
    service: 'hybrid-capture',
    status: 'running',
    externalBrowserService: {
      available: isHealthy,
      status: isHealthy ? 'healthy' : 'unavailable'
    },
    capabilities: {
      screenshot: true,
      flow: isHealthy,
      batch: isHealthy,
      fallback: true
    }
  })
}
