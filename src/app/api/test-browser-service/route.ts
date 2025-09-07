import { NextRequest, NextResponse } from 'next/server'
import { browserService } from '@/lib/browser-service-client'

export async function GET() {
  try {
    console.log('[Test Browser Service] 브라우저 서비스 연결 테스트 시작')

    // 1. 헬스체크
    const isHealthy = await browserService.isHealthy()
    console.log('[Test Browser Service] 헬스체크 결과:', isHealthy)

    if (!isHealthy) {
      return NextResponse.json({
        success: false,
        error: '브라우저 서비스에 연결할 수 없습니다',
        details: {
          healthCheck: false,
          timestamp: new Date().toISOString()
        }
      }, { status: 503 })
    }

    // 2. 간단한 스크린샷 테스트
    const testUrl = 'https://example.com'
    console.log('[Test Browser Service] 테스트 스크린샷 캡처 시작:', testUrl)

    const result = await browserService.captureScreenshot(testUrl, {
      viewport: { width: 800, height: 600 },
      waitTime: 2000
    })

    console.log('[Test Browser Service] 테스트 결과:', {
      success: result.success,
      hasScreenshot: !!result.data?.screenshot,
      title: result.data?.metadata?.title
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: '테스트 스크린샷 캡처 실패',
        details: {
          healthCheck: true,
          screenshotTest: false,
          error: result.error,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '브라우저 서비스 연결 및 기능 테스트 성공',
      details: {
        healthCheck: true,
        screenshotTest: true,
        testUrl,
        capturedTitle: result.data?.metadata?.title,
        screenshotSize: result.data?.screenshot ? `${Math.round(result.data.screenshot.length / 1024)}KB` : 'N/A',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[Test Browser Service] 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: '브라우저 서비스 테스트 중 오류 발생',
      details: {
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, type = 'screenshot' } = await request.json()

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL이 필요합니다'
      }, { status: 400 })
    }

    console.log(`[Test Browser Service] ${type} 테스트 시작:`, url)

    let result
    switch (type) {
      case 'screenshot':
        result = await browserService.captureScreenshot(url, {
          viewport: { width: 1200, height: 800 },
          waitTime: 3000
        })
        break

      case 'flow':
        result = await browserService.captureFlow(url, {
          maxSteps: 3,
          waitTime: 2000
        })
        break

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 테스트 타입입니다'
        }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: `${type} 테스트 실패`,
        details: result.error
      }, { status: 500 })
    }

    // 스크린샷 데이터는 크기 때문에 제외하고 메타데이터만 반환
    const responseData = {
      success: true,
      type,
      url,
      timestamp: new Date().toISOString()
    }

    if (type === 'screenshot' && result.data) {
      responseData.metadata = result.data.metadata
      responseData.screenshotSize = `${Math.round(result.data.screenshot.length / 1024)}KB`
    } else if (type === 'flow' && result.data) {
      responseData.totalSteps = result.data.totalSteps
      responseData.screenshots = result.data.screenshots.map(s => ({
        step: s.step,
        title: s.title,
        url: s.url,
        screenshotSize: `${Math.round(s.screenshot.length / 1024)}KB`
      }))
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('[Test Browser Service] POST 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류 발생',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
