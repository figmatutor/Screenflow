import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
import { launchBrowser } from '@/lib/browser-launcher';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

interface InteractiveCaptureOptions {
  maxClicks?: number;
  clickDelay?: number;
  waitTimeout?: number;
  viewport?: { width: number; height: number };
  selectors?: string[];
  captureFullPage?: boolean;
}

export async function POST(request: NextRequest) {
  if (!request.body) {
    return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
  }

  try {
    const { url, options = {} }: { url: string; options?: InteractiveCaptureOptions } = await request.json();
    
    const {
      maxClicks = 5,
      clickDelay = 150,
      waitTimeout = 2000,
      viewport = { width: 1280, height: 720 },
      selectors = ['a[href]', 'button', '[role="button"]', '[onclick]', '[data-action]'],
      captureFullPage = true
    } = options;

    if (!url) {
      return NextResponse.json({ error: 'URL이 제공되지 않았습니다.' }, { status: 400 });
    }

    const sessionId = uuidv4();
    console.log(`[Interactive Capture] 시작: ${url} (sessionId: ${sessionId}, maxClicks: ${maxClicks})`);

    let browser = null;

    try {
      // Puppeteer 브라우저 실행
      browser = await launchBrowser(viewport.width, viewport.height);
      const page = await browser.newPage();
      
      // Anti-detection 설정
      await setupAntiDetection(page);
      
      // 페이지 오류 이벤트 리스너
      page.on('pageerror', (error) => {
        console.error(`[Interactive Capture] 페이지 오류:`, error.message);
      });
      
      page.on('requestfailed', (request) => {
        console.warn(`[Interactive Capture] 요청 실패:`, request.url(), request.failure()?.errorText);
      });

      console.log(`[Interactive Capture] 메인 페이지 로드: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.setViewport(viewport);

      // ZIP 생성 및 캡처 인덱스
      const zip = new JSZip();
      const screenshots: Array<{filename: string, selector?: string, success: boolean, error?: string}> = [];
      let index = 0;

      // 캡처 함수
      const capture = async (description: string = '', selector?: string) => {
        try {
          console.log(`[Interactive Capture] 스크린샷 ${index + 1}: ${description}`);
          
          const screenshotBuffer = await page.screenshot({ 
            fullPage: captureFullPage,
            type: 'png'
          });
          
          const filename = `screen-${String(index).padStart(3, '0')}.png`;
          zip.file(filename, screenshotBuffer);
          
          screenshots.push({
            filename,
            selector,
            success: true
          });
          
          console.log(`[Interactive Capture] 캡처 완료: ${filename} (${screenshotBuffer.length} bytes) - ${description}`);
          index++;
          
        } catch (error: any) {
          console.error(`[Interactive Capture] 캡처 실패: ${description}`, error.message);
          screenshots.push({
            filename: `screen-${String(index).padStart(3, '0')}-failed.png`,
            selector,
            success: false,
            error: error.message
          });
          index++;
        }
      };

      // 초기 페이지 캡처
      await capture('초기 페이지');

      // 각 선택자별로 클릭 가능한 요소들 탐색 및 캡처
      for (const selector of selectors) {
        try {
          console.log(`[Interactive Capture] 선택자 "${selector}" 요소들 탐색 중...`);
          
          const elements = await page.$$(selector);
          console.log(`[Interactive Capture] "${selector}" 요소 ${elements.length}개 발견`);

          let clickCount = 0;
          for (let i = 0; i < Math.min(elements.length, maxClicks) && clickCount < maxClicks; i++) {
            try {
              // 현재 URL 저장 (돌아가기 용도)
              const currentUrl = page.url();
              
              // 요소가 여전히 페이지에 존재하는지 확인
              const elementHandle = elements[i];
              const isVisible = await elementHandle.isIntersectingViewport();
              
              if (!isVisible) {
                console.log(`[Interactive Capture] 요소 ${i + 1} (${selector}): 뷰포트에 보이지 않음, 스킵`);
                continue;
              }

              // 요소 정보 가져오기
              const elementInfo = await page.evaluate((el) => {
                return {
                  tagName: el.tagName,
                  textContent: (el.textContent || '').trim().substring(0, 50),
                  href: (el as HTMLAnchorElement).href || '',
                  className: el.className
                };
              }, elementHandle);

              console.log(`[Interactive Capture] 클릭 시도 ${clickCount + 1}/${maxClicks}: ${selector} - "${elementInfo.textContent}"`);

              // 요소에 호버 후 클릭
              await elementHandle.hover();
              await new Promise(resolve => setTimeout(resolve, clickDelay));
              
              await elementHandle.click({ delay: clickDelay });
              await new Promise(resolve => setTimeout(resolve, waitTimeout));

              // 클릭 후 페이지 캡처
              await capture(
                `클릭 후: ${selector} - "${elementInfo.textContent}"`,
                selector
              );

              clickCount++;

              // 원래 페이지로 돌아가기 (URL이 변경된 경우에만)
              const newUrl = page.url();
              if (newUrl !== currentUrl) {
                try {
                  console.log(`[Interactive Capture] URL 변경 감지, 뒤로 가기: ${newUrl} → ${currentUrl}`);
                  await page.goBack({ waitUntil: 'networkidle2', timeout: 15000 });
                  await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (backError) {
                  console.warn(`[Interactive Capture] 뒤로 가기 실패, 원본 URL로 재로드: ${currentUrl}`);
                  await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                }
              }

            } catch (clickError: any) {
              console.warn(`[Interactive Capture] 클릭 실패: ${selector} 요소 ${i + 1} - ${clickError.message}`);
              continue;
            }
          }

        } catch (selectorError: any) {
          console.warn(`[Interactive Capture] 선택자 "${selector}" 처리 실패: ${selectorError.message}`);
          continue;
        }
      }

      await browser.close();

      // ZIP 파일 생성
      console.log(`[Interactive Capture] ZIP 생성 중... (${screenshots.length}개 스크린샷)`);
      const zipBuffer = await zip.generateAsync({ 
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      
      console.log(`[Interactive Capture] ZIP 생성 완료: ${zipBuffer.length} bytes`);
      
      // 결과 요약
      const successCount = screenshots.filter(s => s.success).length;
      const failureCount = screenshots.filter(s => !s.success).length;
      console.log(`[Interactive Capture] 완료 - 성공: ${successCount}, 실패: ${failureCount}`);

      // ZIP 파일 응답
      const baseUrl = new URL(url);
      const filename = `interactive-capture-${baseUrl.hostname}-${sessionId.substring(0, 8)}.zip`;
      
      return new NextResponse(Buffer.from(zipBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'no-cache'
        }
      });

    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }

  } catch (error: any) {
    console.error('[Interactive Capture] 전체 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Interactive Capture 실행 중 오류가 발생했습니다.', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Puppeteer 브라우저 실행 함수
async function launchBrowser(viewport: { width: number; height: number }) {
  const isVercel = process.env.VERCEL === '1' || 
                  process.env.AWS_LAMBDA_FUNCTION_NAME ||
                  process.env.NODE_ENV === 'production';

  console.log(`[Interactive Capture] 환경: ${isVercel ? 'Serverless' : 'Local'}`);
  console.log(`[Interactive Capture] 뷰포트: ${viewport.width}x${viewport.height}`);

  if (isVercel) {
    // Vercel 환경에서는 @sparticuz/chromium 사용
    console.log(`[Interactive Capture] Serverless 환경 - @sparticuz/chromium 사용`);
    
    const executablePath = await chromium.executablePath();
    console.log(`[Interactive Capture] Executable path: ${executablePath}`);

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
      defaultViewport: viewport,
      timeout: 30000
    });
  } else {
    // 로컬 환경에서는 시스템 Chrome 사용
    console.log(`[Interactive Capture] 로컬 환경 - 시스템 Chrome 사용`);
    
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
            console.log(`[Interactive Capture] Chrome 경로 발견: ${path}`);
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
      defaultViewport: viewport,
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

    console.log(`[Interactive Capture] Anti-detection 설정 완료`);
  } catch (error: any) {
    console.warn(`[Interactive Capture] Anti-detection 설정 중 오류 (계속 진행): ${error.message}`);
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
