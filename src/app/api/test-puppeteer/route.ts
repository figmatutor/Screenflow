import { NextRequest, NextResponse } from 'next/server';
import { BrowserLauncher } from '@/lib/browser-launcher';
import { createSuccessResponse, createErrorResponse, createOptionsResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    console.log('[Test Puppeteer] 브라우저 테스트 시작');
    
    const browser = await BrowserLauncher.launch();
    console.log('[Test Puppeteer] 브라우저 초기화 성공');
    
    const page = await browser.newPage();
    console.log('[Test Puppeteer] 새 페이지 생성 성공');
    
    // 간단한 네이버 접속 테스트
    await page.goto('https://naver.com', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log('[Test Puppeteer] 네이버 접속 성공');
    
    const title = await page.title();
    console.log(`[Test Puppeteer] 페이지 제목: ${title}`);
    
    // 스크린샷 테스트
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    console.log(`[Test Puppeteer] 스크린샷 생성 성공: ${screenshot.length} bytes`);
    
    await browser.close();
    console.log('[Test Puppeteer] 브라우저 종료 완료');
    
    return createSuccessResponse({
      success: true,
      title,
      screenshotSize: screenshot.length,
      message: 'Puppeteer 테스트 완료 - 모든 단계 성공',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Test Puppeteer] 오류:', error);
    
    return createErrorResponse(
      `Puppeteer 테스트 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

export async function OPTIONS() {
  return createOptionsResponse();
}
