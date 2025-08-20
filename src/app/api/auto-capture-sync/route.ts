import { NextRequest } from 'next/server';
import { AutoCaptureCrawler } from '@/lib/auto-capture-crawler';
import { createSuccessResponse, createErrorResponse, createOptionsResponse, createServerErrorResponse } from '@/lib/api-utils';

// 동기식으로 즉시 결과를 반환하는 auto-capture (백그라운드 프로세스 없음)
export async function POST(request: NextRequest) {
  try {
    const { url, options } = await request.json();

    if (!url) {
      return createErrorResponse('URL is required');
    }

    try {
      new URL(url);
    } catch {
      return createErrorResponse('Invalid URL format');
    }

    const sessionId = `synccapture_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    console.log(`[Auto Capture Sync API] 동기 캡처 시작: ${url} (세션: ${sessionId})`);

    // 직접 크롤링 실행 (백그라운드 없음)
    const crawler = new AutoCaptureCrawler();

    try {
      console.log(`[Auto Capture Sync API] 크롤러 시작: ${url}`);
      
      const result = await crawler.crawlAndCapture(url, sessionId, options);

      console.log(`[Auto Capture Sync API] 크롤링 완료: ${sessionId} - ${result.successCount}/${result.totalPages} 성공`);

      const responseData = {
        sessionId,
        baseUrl: result.baseUrl,
        status: 'completed',
        crawledPages: result.crawledPages.map(page => ({
          url: page.url,
          title: page.title,
          filename: page.filename,
          thumbnail: page.thumbnail,
          success: page.success,
          error: page.error,
          order: page.order,
          depth: page.depth
        })),
        totalPages: result.totalPages,
        successCount: result.successCount,
        failureCount: result.failureCount,
        message: '동기식 캡처 완료'
      };

      return createSuccessResponse(responseData);

    } catch (error) {
      console.error(`[Auto Capture Sync API] 크롤링 실패: ${sessionId}`, error);
      
      return createErrorResponse(
        `크롤링 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        500
      );
    } finally {
      await crawler.close();
    }

  } catch (error) {
    console.error('[Auto Capture Sync API] error:', error);
    return createServerErrorResponse();
  }
}

export async function OPTIONS() {
  return createOptionsResponse();
}
