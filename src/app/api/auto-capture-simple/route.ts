import { NextRequest, NextResponse } from 'next/server';
import { captureStore } from '@/lib/capture-store-hybrid';
import { createSuccessResponse, createErrorResponse, createOptionsResponse, createServerErrorResponse } from '@/lib/api-utils';

// Puppeteer 없이 간단한 모킹 버전
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
    const sessionId = `simple_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    console.log(`[Simple Auto Capture API] 간단한 캡처 시작: ${url} (세션: ${sessionId})`);
    
    // 즉시 완료된 상태로 모킹
    await captureStore.set(sessionId, { 
      status: 'completed',
      createdAt: new Date(),
      result: {
        baseUrl: url,
        crawledPages: [
          {
            url: url,
            title: '테스트 페이지',
            filename: 'test_page.png',
            thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            success: true,
            order: 1,
            depth: 0,
            capturedAt: new Date(),
            fullScreenshot: Buffer.from('test')
          }
        ],
        totalPages: 1,
        successCount: 1,
        failureCount: 0
      }
    });
    
    const responseData = {
      sessionId,
      baseUrl: url,
      status: 'completed',
      message: '간단한 테스트 캡처가 완료되었습니다.',
      totalPages: 1,
      successCount: 1,
      failureCount: 0
    };

    console.log(`[Simple Auto Capture API] 응답 데이터:`, responseData);
    return createSuccessResponse(responseData);
    
  } catch (error) {
    console.error('[Simple Auto Capture API] error:', error);
    return createServerErrorResponse('Simple capture API error: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return createErrorResponse('Session ID is required');
  }
  
  const captureInfo = await captureStore.get(sessionId);
  
  if (!captureInfo) {
    return createErrorResponse('Session not found', 404);
  }
  
  const response = {
    sessionId,
    status: captureInfo.status,
    ...captureInfo.result
  };
  
  return createSuccessResponse(response);
}

export async function OPTIONS() {
  return createOptionsResponse();
}
