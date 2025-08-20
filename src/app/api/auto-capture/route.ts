import { NextRequest, NextResponse } from 'next/server';
import type { NextRequest as NextReq } from 'next/server';
import { AutoCaptureCrawler, CrawlOptions } from '@/lib/auto-capture-crawler';
import { captureStore } from '@/lib/capture-store-memory';
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
    const sessionId = `autocapture_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    console.log(`[Auto Capture API] 자동 캡처 시작: ${url} (세션: ${sessionId})`);
    
    // 백그라운드에서 자동 캡처 작업 시작
    captureStore.set(sessionId, { 
      status: 'processing',
      createdAt: new Date()
    });
    
    // 비동기로 자동 캡처 실행
    startAutoCaptureProcess(url, sessionId, options);
    
    const responseData = {
      sessionId,
      baseUrl: url,
      status: 'processing',
      estimatedTime: 30000, // 30초 예상
      message: '페이지를 크롤링하고 스크린샷을 자동 캡처하고 있습니다...'
    };

    return createSuccessResponse(responseData);
    
  } catch (error) {
    console.error('[Auto Capture API] error:', error);
    return createServerErrorResponse();
  }
}

async function startAutoCaptureProcess(url: string, sessionId: string, options?: Partial<CrawlOptions>) {
  const crawler = new AutoCaptureCrawler();
  
  try {
    console.log(`[Auto Capture API] 자동 캡처 시작: ${url} (세션: ${sessionId})`);
    
    const result = await crawler.crawlAndCapture(url, sessionId, options);
    
    captureStore.update(sessionId, {
      status: 'completed',
      result: {
        baseUrl: result.baseUrl,
        crawledPages: result.crawledPages,
        totalPages: result.totalPages,
        successCount: result.successCount,
        failureCount: result.failureCount
      }
    });
    
    console.log(`[Auto Capture API] 자동 캡처 완료: ${sessionId} - ${result.successCount}/${result.totalPages} 성공`);
    
  } catch (error) {
    console.error(`[Auto Capture API] 자동 캡처 실패: ${sessionId}`, error);
    
    captureStore.update(sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  } finally {
    await crawler.close();
  }
}

// 자동 캡처 상태 확인을 위한 GET 엔드포인트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  console.log(`[Auto Capture GET] Request for sessionId: ${sessionId}`);
  
  if (!sessionId) {
    return createErrorResponse('Session ID is required');
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo) {
    console.log(`[Auto Capture GET] Session not found: ${sessionId}`);
    return createErrorResponse('Session not found', 404);
  }
  
  console.log(`[Auto Capture GET] Session found:`, { 
    status: captureInfo.status, 
    result: captureInfo.result ? {
      totalPages: captureInfo.result.totalPages,
      successCount: captureInfo.result.successCount,
      failureCount: captureInfo.result.failureCount
    } : null
  });
  
  const response = {
    sessionId,
    status: captureInfo.status,
    ...(captureInfo.result && { 
      baseUrl: captureInfo.result.baseUrl,
      crawledPages: captureInfo.result.crawledPages.map(page => ({
        url: page.url,
        title: page.title,
        filename: page.filename,
        thumbnail: page.thumbnail,
        success: page.success,
        error: page.error,
        order: page.order,
        depth: page.depth
      })),
      totalPages: captureInfo.result.totalPages,
      successCount: captureInfo.result.successCount,
      failureCount: captureInfo.result.failureCount
    }),
    ...(captureInfo.error && { error: captureInfo.error })
  };
  
  console.log(`[Auto Capture GET] Response:`, {
    ...response,
    crawledPages: response.crawledPages ? `${response.crawledPages.length} pages` : undefined
  });
  
  return createSuccessResponse(response);
}

export async function OPTIONS() {
  return createOptionsResponse();
}
