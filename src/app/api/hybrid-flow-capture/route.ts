import { NextRequest, NextResponse } from 'next/server'
import { browserService } from '@/lib/browser-service-client'
import { supabaseUtils } from '@/lib/supabase'

interface HybridFlowCaptureRequest {
  url: string
  maxSteps?: number
  triggerKeywords?: string[]
  waitTime?: number
}

function normalizeUrl(inputUrl: string): string {
  try {
    // 프로토콜이 없으면 https:// 추가
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
      inputUrl = 'https://' + inputUrl;
    }
    
    const url = new URL(inputUrl);
    return url.toString();
  } catch (error) {
    throw new Error(`잘못된 URL 형식입니다: ${inputUrl}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Hybrid Flow Capture] API 호출 시작')
    
    const body: HybridFlowCaptureRequest = await request.json()
    const { 
      url: rawUrl, 
      maxSteps = 5, 
      triggerKeywords = ['다음', '시작', 'Next', 'Start', 'Continue', '계속'], 
      waitTime = 3000 
    } = body

    if (!rawUrl) {
      return NextResponse.json({ 
        error: 'URL이 필요합니다.' 
      }, { status: 400 })
    }

    // 사용자 인증 확인
    const user = await supabaseUtils.getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // URL 정규화
    let url: string
    try {
      url = normalizeUrl(rawUrl)
      console.log(`[Hybrid Flow Capture] URL 정규화: ${rawUrl} → ${url}`)
    } catch (error) {
      console.error('[Hybrid Flow Capture] URL 정규화 실패:', error)
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'URL 형식이 올바르지 않습니다.'
      }, { status: 400 })
    }

    console.log(`[Hybrid Flow Capture] ${url} 플로우 캡처 시작 (최대 ${maxSteps}단계)`)

    // 🆕 하이브리드 방식: 외부 브라우저 서비스 우선 시도
    const isServiceHealthy = await browserService.isHealthy()
    
    if (isServiceHealthy) {
      console.log('[Hybrid Flow Capture] 외부 브라우저 서비스 사용')
      
      try {
        const result = await browserService.captureFlow(url, {
          maxSteps,
          triggerKeywords,
          waitTime
        })

        if (result.success && result.data) {
          // 결과를 데이터베이스에 저장
          const captureRecord = await supabaseUtils.createCapture({
            user_id: user.id,
            url,
            title: `플로우 캡처 (${result.data.totalSteps}단계)`,
            description: `${url}의 플로우 캡처 결과`,
            status: 'completed',
            metadata: {
              captureType: 'flow',
              maxSteps,
              actualSteps: result.data.totalSteps,
              triggerKeywords,
              service: 'external-browser-service',
              timestamp: new Date().toISOString()
            }
          })

          console.log(`[Hybrid Flow Capture] 외부 서비스로 캡처 완료: ${result.data.totalSteps}단계`)

          return NextResponse.json({
            success: true,
            url,
            maxSteps,
            actualSteps: result.data.totalSteps,
            screenshots: result.data.screenshots,
            captureId: captureRecord.data?.id,
            service: 'external',
            message: '플로우 캡처가 성공적으로 완료되었습니다. (외부 서비스)'
          })
        }
      } catch (error) {
        console.warn('[Hybrid Flow Capture] 외부 서비스 실패, 로컬 처리로 fallback:', error)
      }
    }

    // 🔄 Fallback: 기존 API 호출
    console.log('[Hybrid Flow Capture] 기존 flow-capture API로 fallback')
    
    try {
      const fallbackResponse = await fetch(`${request.nextUrl.origin}/api/flow-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: rawUrl,
          maxSteps,
          triggerKeywords,
          waitTime
        })
      })

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API 호출 실패: ${fallbackResponse.status}`)
      }

      const fallbackResult = await fallbackResponse.json()
      
      // 응답에 서비스 정보 추가
      return NextResponse.json({
        ...fallbackResult,
        service: 'local-fallback',
        message: fallbackResult.message + ' (로컬 fallback)'
      })

    } catch (fallbackError) {
      console.error('[Hybrid Flow Capture] Fallback API 호출 실패:', fallbackError)
      
      return NextResponse.json({
        success: false,
        error: '플로우 캡처 처리 중 오류가 발생했습니다.',
        details: {
          externalService: 'unavailable',
          fallbackService: 'failed',
          error: fallbackError instanceof Error ? fallbackError.message : '알 수 없는 오류'
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Hybrid Flow Capture] API 오류:', error)
    return NextResponse.json({
      success: false,
      error: `API 오류: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
}

export async function GET() {
  // 서비스 상태 확인 엔드포인트
  const isHealthy = await browserService.isHealthy()
  
  return NextResponse.json({
    service: 'hybrid-flow-capture',
    status: 'running',
    externalBrowserService: {
      available: isHealthy,
      status: isHealthy ? 'healthy' : 'unavailable'
    },
    capabilities: {
      flowCapture: true,
      fallback: true,
      maxSteps: 10,
      supportedTriggers: ['다음', '시작', 'Next', 'Start', 'Continue', '계속']
    }
  })
}
