import { NextRequest, NextResponse } from 'next/server';
import { launchBrowser } from '@/lib/browser-launcher';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    console.log(`[Test Screenshot API] 스크린샷 캡처 시작: ${url}`);

    const browser = await launchBrowser();
    const page = await browser.newPage();
    
    // 페이지 오류 이벤트 리스너
    page.on('pageerror', (error) => {
      console.error(`[Test Screenshot API] 페이지 오류:`, error.message);
    });
    
    page.on('requestfailed', (request) => {
      console.warn(`[Test Screenshot API] 요청 실패:`, request.url(), request.failure()?.errorText);
    });

    console.log(`[Test Screenshot API] 페이지 로드 시작: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 추가 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`[Test Screenshot API] 스크린샷 캡처 시작`);
    const screenshotBuffer = await page.screenshot({ 
      type: 'png',
      fullPage: false
    });
    
    console.log(`[Test Screenshot API] 스크린샷 캡처 완료: ${screenshotBuffer.length} bytes`);

    await browser.close();
    console.log(`[Test Screenshot API] 브라우저 종료 완료`);

    // PNG 이미지로 응답
    return new NextResponse(Buffer.from(screenshotBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': screenshotBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('[Test Screenshot API] 스크린샷 캡처 실패:', error);
    
    return NextResponse.json(
      { 
        error: '스크린샷 캡처 실패', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메서드 (CORS 처리)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}