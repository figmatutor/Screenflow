import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

    // Vercel/serverless 환경 감지
    const isVercel = process.env.VERCEL === '1' || 
                    process.env.AWS_LAMBDA_FUNCTION_NAME ||
                    process.env.NODE_ENV === 'production';

    console.log(`[Test Screenshot API] 환경: ${isVercel ? 'Serverless' : 'Local'}`);

    let browser;
    
    if (isVercel) {
      // Vercel 환경에서는 @sparticuz/chromium 사용
      console.log(`[Test Screenshot API] Serverless 환경 - @sparticuz/chromium 사용`);
      
      const executablePath = await chromium.executablePath();
      console.log(`[Test Screenshot API] Executable path: ${executablePath}`);

      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process',
          '--disable-features=VizDisplayCompositor'
        ],
        executablePath,
        headless: chromium.headless,
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000
      });
    } else {
      // 로컬 환경에서는 시스템 Chrome 사용
      console.log(`[Test Screenshot API] 로컬 환경 - 시스템 Chrome 사용`);
      
      // 로컬 Chrome 경로 자동 감지
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome-stable', // Linux
        '/usr/bin/google-chrome', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows 32-bit
      ];
      
      let executablePath = process.env.CHROME_EXECUTABLE_PATH;
      
      if (!executablePath) {
        // 시스템에서 Chrome 경로 찾기
        const fs = require('fs');
        for (const path of possiblePaths) {
          try {
            if (fs.existsSync(path)) {
              executablePath = path;
              console.log(`[Test Screenshot API] Chrome 경로 발견: ${path}`);
              break;
            }
          } catch (err) {
            // 경로 확인 실패 시 다음 경로 시도
          }
        }
      }
      
      if (!executablePath) {
        throw new Error('Chrome 실행 파일을 찾을 수 없습니다. CHROME_EXECUTABLE_PATH 환경변수를 설정하거나 Chrome을 설치해주세요.');
      }
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1280, height: 720 },
        executablePath
      });
    }

    console.log(`[Test Screenshot API] 브라우저 초기화 완료`);

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
    const blob = new Blob([screenshotBuffer.buffer], { type: 'image/png' });
    return new NextResponse(blob, {
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
