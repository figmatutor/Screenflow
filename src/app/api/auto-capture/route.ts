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
    
      // 비동기로 자동 캡처 실행 (임시로 모킹으로 대체)
  startMockAutoCaptureProcess(url, sessionId, options);
    
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

// 임시: Vercel 제한으로 인한 모킹 솔루션
async function startMockAutoCaptureProcess(url: string, sessionId: string, options?: Partial<CrawlOptions>) {
  try {
    console.log(`[Mock Auto Capture API] 모킹 캡처 시작: ${url} (세션: ${sessionId})`);
    
    // 2-5초 시뮬레이션
    const processingTime = 2000 + Math.random() * 3000;
    
    setTimeout(() => {
      try {
        // 가상의 크롤링 결과 생성
        const mockPages = generateMockPages(url);
        
        captureStore.update(sessionId, {
          status: 'completed',
          result: {
            baseUrl: url,
            crawledPages: mockPages,
            totalPages: mockPages.length,
            successCount: mockPages.filter(p => p.success).length,
            failureCount: mockPages.filter(p => !p.success).length
          }
        });
        
        console.log(`[Mock Auto Capture API] 모킹 캡처 완료: ${sessionId} - ${mockPages.length}개 페이지`);
        
      } catch (error) {
        console.error(`[Mock Auto Capture API] 모킹 캡처 실패: ${sessionId}`, error);
        captureStore.update(sessionId, {
          status: 'failed',
          error: '모킹 캡처 중 오류 발생'
        });
      }
    }, processingTime);
    
  } catch (error) {
    console.error(`[Mock Auto Capture API] 즉시 실패: ${sessionId}`, error);
    captureStore.update(sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

function generateMockPages(baseUrl: string) {
  const domain = new URL(baseUrl).hostname;
  const mockPages = [
    {
      url: baseUrl,
      title: `${domain} - 홈페이지`,
      filename: '01_homepage.png',
      thumbnail: generateMockThumbnail(),
      success: true,
      order: 1,
      depth: 0,
      capturedAt: new Date(),
      fullScreenshot: Buffer.from('mock-screenshot-data-1')
    },
    {
      url: `${baseUrl}/about`,
      title: `${domain} - 회사소개`,
      filename: '02_about.png',
      thumbnail: generateMockThumbnail(),
      success: true,
      order: 2,
      depth: 1,
      capturedAt: new Date(),
      fullScreenshot: Buffer.from('mock-screenshot-data-2')
    },
    {
      url: `${baseUrl}/products`,
      title: `${domain} - 제품소개`,
      filename: '03_products.png',
      thumbnail: generateMockThumbnail(),
      success: true,
      order: 3,
      depth: 1,
      capturedAt: new Date(),
      fullScreenshot: Buffer.from('mock-screenshot-data-3')
    }
  ];
  
  return mockPages;
}

function generateMockThumbnail(): string {
  // 1x1 투명 PNG를 Base64로 인코딩
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
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
