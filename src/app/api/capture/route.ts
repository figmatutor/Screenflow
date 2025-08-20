import { NextRequest, NextResponse } from 'next/server';
import { ScreenshotCapture } from '@/lib/screenshot-capture';
import { captureStore } from '@/lib/capture-store';
import { createSuccessResponse, createErrorResponse, createOptionsResponse, createServerErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const { url, options } = await request.json();
    
    if (!url) {
      return createErrorResponse('URL is required');
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return createErrorResponse('Invalid URL format');
    }

    // 세션 ID 생성
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // 백그라운드에서 캡처 작업 시작
    captureStore.set(sessionId, { 
      status: 'processing',
      createdAt: new Date()
    });
    
    // 비동기로 스크린샷 캡처 실행
    startCaptureProcess(url, sessionId, options);
    
    const responseData = {
      sessionId,
      baseUrl: url,
      status: 'processing',
      estimatedTime: 30000, // 30초 예상
      message: '스크린샷 캡처를 시작합니다...'
    };

    return createSuccessResponse(responseData);
    
  } catch (error) {
    console.error('Capture API error:', error);
    return createServerErrorResponse();
  }
}

async function startCaptureProcess(url: string, sessionId: string, options?: any) {
  const capture = new ScreenshotCapture();
  
  try {
    console.log(`[Capture API] 플로우 캡처 시작: ${url} (세션: ${sessionId})`);
    if (options) {
      console.log(`[Capture API] 옵션:`, options);
    }
    
    const result = await capture.captureWebsiteFlow(url, sessionId, options);
    
    captureStore.update(sessionId, {
      status: 'completed',
      result: {
        totalPages: result.totalPages,
        successCount: result.successCount,
        failureCount: result.failureCount,
        maxDepthReached: result.maxDepthReached,
        totalSteps: result.flowSteps.length,
        zipBuffer: result.zipBuffer
      }
    });
    
    console.log(`[Capture API] 플로우 캡처 완료: ${sessionId}`);
    console.log(`[Capture API] 결과: ${result.successCount}/${result.totalPages} 성공, 최대 깊이: ${result.maxDepthReached}, 총 단계: ${result.flowSteps.length}`);
    
  } catch (error) {
    console.error(`[Capture API] 캡처 실패: ${sessionId}`, error);
    
    captureStore.update(sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  } finally {
    await capture.close();
  }
}

// 캡처 상태 확인을 위한 GET 엔드포인트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return createErrorResponse('Session ID is required');
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo) {
    return createErrorResponse('Session not found', 404);
  }
  
  const responseData = {
    sessionId,
    status: captureInfo.status,
    ...(captureInfo.result && { 
      totalPages: captureInfo.result.totalPages,
      successCount: captureInfo.result.successCount,
      failureCount: captureInfo.result.failureCount,
      maxDepthReached: captureInfo.result.maxDepthReached,
      totalSteps: captureInfo.result.totalSteps
    }),
    ...(captureInfo.error && { error: captureInfo.error })
  };
  
  return createSuccessResponse(responseData);
}

// OPTIONS 메서드 추가 (CORS preflight 처리)
export async function OPTIONS() {
  return createOptionsResponse();
}
