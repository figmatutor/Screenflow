import { NextRequest, NextResponse } from 'next/server';
import { AutoCaptureCrawler, CrawlOptions } from '@/lib/auto-capture-crawler';
import { captureStore } from '@/lib/capture-store';

export async function POST(request: NextRequest) {
  try {
    const { url, options } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // 세션 ID 생성
    const sessionId = `autocapture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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

    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[Auto Capture API] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
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
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo) {
    console.log(`[Auto Capture GET] Session not found: ${sessionId}`);
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
  
  return NextResponse.json(response);
}
