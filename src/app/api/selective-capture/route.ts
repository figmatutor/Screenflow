import { NextRequest, NextResponse } from 'next/server';
import { SelectiveCapture, CaptureRequest } from '@/lib/selective-capture';
import { captureStore } from '@/lib/capture-store';
import { createSuccessResponse, createErrorResponse, createOptionsResponse, createServerErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, selectedUrls, sessionId: originalSessionId } = await request.json();
    
    if (!baseUrl || !selectedUrls || !Array.isArray(selectedUrls) || selectedUrls.length === 0) {
      return createErrorResponse('baseUrl and selectedUrls array are required');
    }

    // URL 유효성 검사
    try {
      new URL(baseUrl);
      selectedUrls.forEach(url => new URL(url));
    } catch {
      return createErrorResponse('Invalid URL format');
    }

    // 세션 ID 생성
    const sessionId = `capture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Selective Capture API] 선택적 캡처 시작: ${selectedUrls.length}개 URL (세션: ${sessionId})`);
    
    // 백그라운드에서 선택적 캡처 작업 시작
    captureStore.set(sessionId, { 
      status: 'processing',
      createdAt: new Date(),
      result: {
        totalRequested: selectedUrls.length,
        successCount: 0,
        failureCount: 0,
        currentIndex: 0
      }
    });
    
    // 비동기로 선택적 캡처 실행
    startSelectiveCapture({
      sessionId,
      baseUrl,
      selectedUrls
    });
    
    const responseData = {
      sessionId,
      baseUrl,
      selectedUrls,
      totalRequested: selectedUrls.length,
      status: 'processing',
      estimatedTime: selectedUrls.length * 5000, // URL당 5초 예상
      message: '선택된 페이지들을 순차적으로 캡처하고 있습니다...'
    };

    return createSuccessResponse(responseData);
    
  } catch (error) {
    console.error('[Selective Capture API] error:', error);
    return createServerErrorResponse();
  }
}

async function startSelectiveCapture(request: CaptureRequest) {
  const capture = new SelectiveCapture();
  
  try {
    console.log(`[Selective Capture API] 캡처 시작: ${request.selectedUrls.length}개 URL (세션: ${request.sessionId})`);
    
    // 진행 상황 업데이트를 위한 콜백
    const progressCallback = (progress: { current: number; total: number; url: string }) => {
      captureStore.update(request.sessionId, {
        result: {
          totalRequested: progress.total,
          successCount: 0, // 완료 후 업데이트
          failureCount: 0, // 완료 후 업데이트
          currentIndex: progress.current,
          currentUrl: progress.url
        }
      });
    };
    
    const result = await capture.captureSelected(request, progressCallback);
    
    captureStore.update(request.sessionId, {
      status: 'completed',
      result: {
        totalRequested: result.totalRequested,
        successCount: result.successCount,
        failureCount: result.failureCount,
        zipBuffer: result.zipBuffer,
        capturedScreenshots: result.capturedScreenshots
      }
    });
    
    console.log(`[Selective Capture API] 캡처 완료: ${request.sessionId} - ${result.successCount}/${result.totalRequested} 성공`);
    
  } catch (error) {
    console.error(`[Selective Capture API] 캡처 실패: ${request.sessionId}`, error);
    
    captureStore.update(request.sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  } finally {
    await capture.close();
  }
}

// 선택적 캡처 상태 확인을 위한 GET 엔드포인트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  console.log(`[Selective Capture GET] Request for sessionId: ${sessionId}`);
  
  if (!sessionId) {
    return createErrorResponse('Session ID is required');
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo) {
    console.log(`[Selective Capture GET] Session not found: ${sessionId}`);
    return createErrorResponse('Session not found', 404);
  }
  
  console.log(`[Selective Capture GET] Session found:`, { 
    status: captureInfo.status, 
    result: captureInfo.result ? {
      totalRequested: captureInfo.result.totalRequested,
      successCount: captureInfo.result.successCount,
      failureCount: captureInfo.result.failureCount,
      currentIndex: captureInfo.result.currentIndex
    } : null
  });
  
  const response = {
    sessionId,
    status: captureInfo.status,
    ...(captureInfo.result && { 
      totalRequested: captureInfo.result.totalRequested,
      successCount: captureInfo.result.successCount,
      failureCount: captureInfo.result.failureCount,
      currentIndex: captureInfo.result.currentIndex,
      currentUrl: captureInfo.result.currentUrl
    }),
    ...(captureInfo.error && { error: captureInfo.error })
  };
  
  console.log(`[Selective Capture GET] Response:`, response);
  
  return createSuccessResponse(response);
}

// OPTIONS 메서드 추가 (CORS preflight 처리)
export async function OPTIONS() {
  return createOptionsResponse();
}
