import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
import fs from 'fs';

interface AutoCaptureFlowOptions {
  maxLinks?: number;
  timeout?: number;
  scrollDelay?: number;
  scrollDistance?: number;
  waitUntil?: 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  viewportWidth?: number;
  viewportHeight?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { url, options = {} }: { url: string; options?: AutoCaptureFlowOptions } = await request.json();
    
    const {
      maxLinks = 10,
      timeout = 30000,
      scrollDelay = 300,
      scrollDistance = 300,
      waitUntil = 'networkidle2',
      viewportWidth = 1440,
      viewportHeight = 900
    } = options;

    if (!url) {
      return NextResponse.json(
        { error: 'URL이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    console.log(`[Auto Capture Flow] 시작: ${url} (maxLinks: ${maxLinks})`);

    // Puppeteer 브라우저 실행
    const browser = await launchBrowser(viewportWidth, viewportHeight);
    
    try {
      const page = await browser.newPage();
      
      // Anti-detection 설정
      await setupAntiDetection(page);
      
      // 페이지 오류 이벤트 리스너
      page.on('pageerror', (error) => {
        console.error(`[Auto Capture Flow] 페이지 오류:`, error.message);
      });
      
      page.on('requestfailed', (request) => {
        console.warn(`[Auto Capture Flow] 요청 실패:`, request.url(), request.failure()?.errorText);
      });

      console.log(`[Auto Capture Flow] 메인 페이지 로드: ${url}`);
      await page.goto(url, { waitUntil, timeout });

      console.log(`[Auto Capture Flow] 스크롤을 통한 lazy-load 요소 로딩 시작`);
      // [1] 스크롤을 통해 lazy-load 요소 모두 로딩
      await scrollToBottom(page, scrollDistance, scrollDelay);
      console.log(`[Auto Capture Flow] 스크롤 완료`);

      console.log(`[Auto Capture Flow] 링크 수집 시작`);
      // [2] 현재 페이지에서 모든 a[href] 링크 수집
      const links = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => href && href.startsWith('http'))
      );

      const uniqueLinks = [...new Set(links)].slice(0, maxLinks);
      console.log(`[Auto Capture Flow] 수집된 링크: ${links.length}개, 중복 제거: ${uniqueLinks.length}개`);
      uniqueLinks.forEach((link, i) => console.log(`  ${i + 1}. ${link}`));

      // ZIP 생성
      const zip = new JSZip();
      const screenshots: Array<{url: string, filename: string, success: boolean, error?: string}> = [];

      // [3] 각 링크 페이지 이동 → 스크롤 → 캡처
      let count = 1;
      for (const link of uniqueLinks) {
        try {
          console.log(`[Auto Capture Flow] 링크 ${count}/${uniqueLinks.length} 처리 중: ${link}`);
          
          const subPage = await browser.newPage();
          
          // Anti-detection 설정
          await setupAntiDetection(subPage);
          
          // 서브 페이지 오류 이벤트 리스너
          subPage.on('pageerror', (error) => {
            console.error(`[Auto Capture Flow] 서브 페이지 오류 (${link}):`, error.message);
          });
          
          subPage.on('requestfailed', (request) => {
            console.warn(`[Auto Capture Flow] 서브 페이지 요청 실패 (${link}):`, request.url(), request.failure()?.errorText);
          });

          console.log(`[Auto Capture Flow] 페이지 로드: ${link}`);
          await subPage.goto(link, { waitUntil, timeout });

          console.log(`[Auto Capture Flow] 스크롤 시작: ${link}`);
          await scrollToBottom(subPage, scrollDistance, scrollDelay);

          console.log(`[Auto Capture Flow] 스크린샷 촬영: ${link}`);
          const screenshotBuffer = await subPage.screenshot({ 
            fullPage: true,
            type: 'png'
          });

          const filename = `${String(count).padStart(2, '0')}.png`;
          zip.file(filename, screenshotBuffer);
          
          screenshots.push({
            url: link,
            filename,
            success: true
          });

          console.log(`[Auto Capture Flow] ✅ 캡처 완료: ${link} → ${filename} (${screenshotBuffer.length} bytes)`);
          await subPage.close();
          count++;

        } catch (err: any) {
          console.warn(`[Auto Capture Flow] ⚠️ 캡처 실패: ${link} - ${err.message}`);
          
          screenshots.push({
            url: link,
            filename: `${String(count).padStart(2, '0')}-failed.png`,
            success: false,
            error: err.message
          });
          count++;
        }
      }

      await page.close();
      await browser.close();

      // [4] ZIP 생성
      console.log(`[Auto Capture Flow] ZIP 파일 생성 중... (${screenshots.length}개 파일)`);
      const zipBuffer = await zip.generateAsync({ 
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      console.log(`[Auto Capture Flow] ZIP 생성 완료: ${zipBuffer.length} bytes`);
      
      // 결과 요약
      const successCount = screenshots.filter(s => s.success).length;
      const failureCount = screenshots.filter(s => !s.success).length;
      console.log(`[Auto Capture Flow] 완료 - 성공: ${successCount}, 실패: ${failureCount}`);

      // [5] ZIP 파일 응답
      const baseUrl = new URL(url);
      const filename = `auto-capture-flow-${baseUrl.hostname}-${Date.now()}.zip`;
      
      const blob = new Blob([zipBuffer], { type: 'application/zip' });
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'no-cache'
        }
      });

    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error: any) {
    console.error('[Auto Capture Flow] 전체 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Auto Capture Flow 실행 중 오류가 발생했습니다.', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// 스크롤 함수 - 원본 스크립트와 동일한 로직
async function scrollToBottom(page: any, scrollDistance: number = 300, scrollDelay: number = 300) {
  await page.evaluate(async (distance: number, delay: number) => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }, scrollDistance, scrollDelay);
}

// Puppeteer 브라우저 실행 함수
async function launchBrowser(viewportWidth: number = 1440, viewportHeight: number = 900) {
  const isVercel = process.env.VERCEL === '1' || 
                  process.env.AWS_LAMBDA_FUNCTION_NAME ||
                  process.env.NODE_ENV === 'production';

  console.log(`[Auto Capture Flow] 환경: ${isVercel ? 'Serverless' : 'Local'}`);
  console.log(`[Auto Capture Flow] 뷰포트: ${viewportWidth}x${viewportHeight}`);

  const defaultViewport = { width: viewportWidth, height: viewportHeight };

  if (isVercel) {
    // Vercel 환경에서는 @sparticuz/chromium 사용
    console.log(`[Auto Capture Flow] Serverless 환경 - @sparticuz/chromium 사용`);
    
    const executablePath = await chromium.executablePath();
    console.log(`[Auto Capture Flow] Executable path: ${executablePath}`);

    return await puppeteer.launch({
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
        '--disable-features=VizDisplayCompositor',
        // Bot detection 방지
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ],
      executablePath,
      headless: true,
      defaultViewport,
      timeout: 30000
    });
  } else {
    // 로컬 환경에서는 시스템 Chrome 사용
    console.log(`[Auto Capture Flow] 로컬 환경 - 시스템 Chrome 사용`);
    
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
      for (const path of possiblePaths) {
        try {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`[Auto Capture Flow] Chrome 경로 발견: ${path}`);
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
    
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        // Bot detection 방지
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ],
      defaultViewport,
      executablePath,
      timeout: 30000
    });
  }
}

// Anti-detection 설정
async function setupAntiDetection(page: any) {
  try {
    // User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // HTTP 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // Automation 감지 방지
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en'],
      });
    });

    console.log(`[Auto Capture Flow] Anti-detection 설정 완료`);
  } catch (error: any) {
    console.warn(`[Auto Capture Flow] Anti-detection 설정 중 오류 (계속 진행): ${error.message}`);
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
