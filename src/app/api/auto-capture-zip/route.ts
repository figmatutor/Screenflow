import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
import fs from 'fs';

interface CaptureOptions {
  maxLinks?: number;
  maxDepth?: number;
  timeout?: number;
  waitUntil?: 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  captureFlow?: boolean; // 버튼 클릭 플로우 캡처 활성화
  flowKeywords?: string[]; // 클릭할 버튼 텍스트 키워드
  maxFlowSteps?: number; // 최대 플로우 단계 수
}

interface CaptureResult {
  url: string;
  filename: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { url, options = {} }: { url: string; options?: CaptureOptions } = await req.json();
    
    const {
      maxLinks = 5,
      timeout = 60000, // 더 긴 타임아웃
      waitUntil = 'networkidle2', // 더 안정적인 로딩 대기
      captureFlow = false, // 플로우 캡처 비활성화가 기본값
      flowKeywords = ['다음', '시작', 'Next', 'Start', '계속', 'Continue'], // 기본 키워드
      maxFlowSteps = 5 // 최대 5단계까지
    } = options;

    if (!url) {
      return NextResponse.json({ error: 'URL이 제공되지 않았습니다.' }, { status: 400 });
    }

    // URL 유효성 검사
    let baseUrl: URL;
    try {
      baseUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: '유효하지 않은 URL 형식입니다.' }, { status: 400 });
    }

    console.log(`[Auto Capture ZIP] 시작: ${url} (maxLinks: ${maxLinks})`);

    // 1. Puppeteer 브라우저 실행
    const browser = await launchBrowser();
    
    let internalLinks: string[] = [];
    
    try {
      // 2. 링크 수집을 위한 초기 페이지 생성
      const initialPage = await browser.newPage();
      
      // Anti-detection 설정 적용
      await setupAntiDetection(initialPage);
      
      console.log(`[Auto Capture ZIP] 메인 페이지 로드 시작: ${url}`);
      
      try {
        await initialPage.goto(url, { waitUntil, timeout });
        await autoScroll(initialPage); // 전체 콘텐츠 로딩

        console.log(`[Auto Capture ZIP] 메인 페이지 로드 및 스크롤 완료: ${url}`);

        // 하이퍼링크 수집 및 필터링 (다양한 선택자 사용)
        const links = await initialPage.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors
            .map(a => (a as HTMLAnchorElement).href)
            .filter(href => href && (href.startsWith('http://') || href.startsWith('https://')));
        });

        console.log(`[Auto Capture ZIP] 추출된 전체 링크 수: ${links.length}`);
        console.log(`[Auto Capture ZIP] 링크 샘플:`, links.slice(0, 5));

        internalLinks = Array.from(new Set(links))
          .filter(link => {
            try {
              const linkUrl = new URL(link);
              const isInternal = linkUrl.hostname === baseUrl.hostname;
              if (isInternal) {
                console.log(`[Auto Capture ZIP] 내부 링크 발견: ${link}`);
              }
              return isInternal;
            } catch (error) {
              console.warn(`[Auto Capture ZIP] URL 파싱 실패: ${link}`);
              return false;
            }
          });

        console.log(`[Auto Capture ZIP] 필터링된 내부 링크 수: ${internalLinks.length}`);
        
      } catch (error: any) {
        console.error(`[Auto Capture ZIP] 메인 페이지 로드 실패: ${error.message}`);
        await initialPage.close();
        throw error;
      }

      await initialPage.close();

      console.log(`[Auto Capture ZIP] 내부 링크 수집 완료: ${internalLinks.length}개`);
      internalLinks.forEach((link, i) => console.log(`  ${i + 1}. ${link}`));

      // 3. 각 링크별 스크린샷 캡처 (수정된 로직)
      const zip = new JSZip();
      const visited = new Set<string>();
      const screenshots: CaptureResult[] = [];
      
      // 메인 페이지 + 내부 링크들을 순서대로 캡처
      const allUrlsToCapture = [url, ...internalLinks.slice(0, maxLinks - 1)];
      
      console.log(`[Auto Capture ZIP] 캡처할 URL 목록 (총 ${allUrlsToCapture.length}개):`);
      allUrlsToCapture.forEach((captureUrl, i) => console.log(`  ${i + 1}. ${captureUrl}`));

      for (let count = 0; count < allUrlsToCapture.length && count < maxLinks; count++) {
        const targetUrl = allUrlsToCapture[count];
        
        // URL 정규화 (쿼리 파라미터, 해시 제거)
        const normalizedUrl = normalizeUrl(targetUrl);
        
        if (visited.has(normalizedUrl)) {
          console.log(`[Auto Capture ZIP] 중복 URL 스킵: ${targetUrl} (정규화: ${normalizedUrl})`);
          continue;
        }
        visited.add(normalizedUrl);

        console.log(`[Auto Capture ZIP] 캡처 시작 (${count + 1}/${allUrlsToCapture.length}): ${targetUrl}`);

        const newPage = await browser.newPage();
        try {
          // Anti-detection 설정 적용
          await setupAntiDetection(newPage);
          
          // 페이지 오류 이벤트 리스너 추가
          newPage.on('pageerror', (error: any) => {
            console.error(`[Auto Capture ZIP] 페이지 오류 (${targetUrl}):`, error.message);
          });
          
          newPage.on('response', (response: any) => {
            if (response.status() >= 400) {
              console.warn(`[Auto Capture ZIP] HTTP 오류 (${targetUrl}): ${response.status()} ${response.statusText()}`);
            }
          });

          newPage.on('requestfailed', (request: any) => {
            console.warn(`[Auto Capture ZIP] 요청 실패 (${targetUrl}):`, request.url(), request.failure()?.errorText);
          });

          console.log(`[Auto Capture ZIP] 페이지 이동 중: ${targetUrl}`);
          await newPage.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', // 더 안정적인 로딩 대기
            timeout 
          });
          
          console.log(`[Auto Capture ZIP] 페이지 로드 완료, 스크롤 시작: ${targetUrl}`);
          await autoScroll(newPage); // 전체 콘텐츠 로딩

          console.log(`[Auto Capture ZIP] 스크린샷 촬영 시작: ${targetUrl}`);
          // 전체 페이지 스크린샷 촬영
          const screenshotBuffer = await newPage.screenshot({ 
            fullPage: true,
            type: 'png'
          });
          
          const filename = `screenshot_${count + 1}.png`;
          zip.file(filename, screenshotBuffer);
          
          screenshots.push({
            url: targetUrl,
            filename,
            success: true
          });

          console.log(`[Auto Capture ZIP] 캡처 성공 (${screenshotBuffer.length}바이트): ${targetUrl} → ${filename}`);

          // 플로우 캡처가 활성화된 경우 버튼 클릭 시퀀스 실행
          if (captureFlow) {
            console.log(`[Auto Capture ZIP] 플로우 캡처 모드 활성화: ${targetUrl}`);
            await captureButtonFlow(newPage, zip, screenshots, flowKeywords, maxFlowSteps, targetUrl, count, timeout, waitUntil);
          }
        } catch (error: any) {
          console.error(`[Auto Capture ZIP] 캡처 실패: ${targetUrl}`, error.message);
          screenshots.push({
            url: targetUrl,
            filename: `screenshot_${count + 1}.png`,
            success: false,
            error: error.message
          });
        } finally {
          await newPage.close();
        }
      }

      await browser.close();

      // 4. ZIP 압축
      console.log(`[Auto Capture ZIP] ZIP 생성 시작: ${screenshots.length}개 파일`);
      const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
      
      console.log(`[Auto Capture ZIP] 완료: ${zipBuffer.length}바이트 ZIP 파일 생성`);
      
      // 성공/실패 요약
      const successCount = screenshots.filter(s => s.success).length;
      const failureCount = screenshots.filter(s => !s.success).length;
      console.log(`[Auto Capture ZIP] 결과: 성공 ${successCount}개, 실패 ${failureCount}개`);

      // 5. ZIP 파일 응답
      const filename = `screenshots-${baseUrl.hostname}-${Date.now()}.zip`;
      
      const blob = new Blob([zipBuffer], { type: 'application/zip' });
      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length.toString()
        }
      });

    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error: any) {
    console.error('[Auto Capture ZIP] 오류 발생:', error);
    return NextResponse.json({
      error: '스크린샷 캡처 중 오류가 발생했습니다.',
      details: error.message
    }, { status: 500 });
  }
}

// Puppeteer 브라우저 실행 (Vercel 환경 최적화)
async function launchBrowser() {
  const isVercel = process.env.VERCEL === '1' || 
                  process.env.AWS_LAMBDA_FUNCTION_NAME || 
                  process.env.NODE_ENV === 'production';

  if (isVercel) {
    console.log(`[Auto Capture ZIP] Vercel 환경 - @sparticuz/chromium 사용`);
    
    return await puppeteer.launch({
      args: [
        ...chromium.args,
        // Bot detection 방지
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-default-browser-check',
        '--disable-extensions-file-access-check',
        '--disable-features=TranslateUI'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
      timeout: 30000
    });
  } else {
    console.log(`[Auto Capture ZIP] 로컬 환경 - 시스템 Chrome 사용`);
    
    // 로컬 Chrome 경로 탐지
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/google-chrome-stable', // Linux
      '/usr/bin/google-chrome', // Linux
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows 32-bit
    ];

    let executablePath = process.env.CHROME_EXECUTABLE_PATH;
    
    if (!executablePath) {
      for (const path of possiblePaths) {
        try {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`[Auto Capture ZIP] Chrome 경로 발견: ${path}`);
            break;
          }
        } catch (err) {
          // 경로 확인 실패, 다음 경로 시도
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
        '--single-process',
        '--disable-features=VizDisplayCompositor',
        // Bot detection 방지
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-default-browser-check',
        '--disable-extensions-file-access-check',
        '--disable-features=TranslateUI'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      timeout: 30000
    });
  }
}

// URL 정규화 함수 (중복 URL 방지)
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // 쿼리 파라미터와 해시 제거
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

// 페이지 Bot Detection 방지 설정
async function setupAntiDetection(page: any) {
  try {
    // User-Agent 설정 (실제 브라우저처럼)
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // HTTP 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
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
      // webdriver 속성 제거
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Chrome runtime 정보 추가
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          }
        ],
      });

      // Languages 설정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en'],
      });

      // Permission API (타입 안전하게 수정)
      try {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission } as any) :
            originalQuery(parameters)
        );
      } catch (e) {
        // Permission API 수정 실패 시 무시
      }
    });

    // Request Interception 설정 (불필요한 리소스 차단)
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      try {
        const resourceType = request.resourceType();
        const url = request.url();

        // 불필요한 리소스 차단 (성능 최적화)
        if (resourceType === 'image' && !url.includes('logo') && !url.includes('icon')) {
          request.abort();
        } else if (resourceType === 'font') {
          request.abort();
        } else if (resourceType === 'media') {
          request.abort();
        } else if (resourceType === 'stylesheet' && url.includes('analytics')) {
          request.abort();
        } else {
          request.continue();
        }
      } catch (error) {
        // 요청 처리 중 오류 시 기본 동작 수행
        try {
          request.continue();
        } catch (e) {
          // Request already handled
        }
      }
    });

    console.log(`[Anti-Detection] 페이지 Bot Detection 방지 설정 완료`);
  } catch (error: any) {
    console.warn(`[Anti-Detection] 설정 중 오류 (계속 진행): ${error.message}`);
  }
}

// 버튼 클릭 플로우 캡처 함수
async function captureButtonFlow(
  page: any,
  zip: JSZip,
  screenshots: CaptureResult[],
  flowKeywords: string[],
  maxFlowSteps: number,
  baseUrl: string,
  baseCount: number,
  timeout: number,
  waitUntil: 'domcontentloaded' | 'networkidle0' | 'networkidle2'
) {
  let flowStep = 1;
  
  console.log(`[Flow Capture] 플로우 캡처 시작: ${baseUrl}`);
  
  while (flowStep <= maxFlowSteps) {
    try {
      console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 버튼 탐색 중...`);
      
      // 페이지의 모든 버튼과 클릭 가능한 요소들 탐색
      const clickableElements = await page.$$('button, a, input[type="button"], input[type="submit"], [role="button"], .btn, .button');
      
      let foundElement = null;
      let elementText = '';
      
      // 키워드가 포함된 버튼 찾기
      for (const element of clickableElements) {
        try {
          const text = await page.evaluate((el: any) => {
            return el.innerText || el.textContent || el.value || el.alt || '';
          }, element);
          
          // 키워드 매칭 확인
          const hasKeyword = flowKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasKeyword) {
            foundElement = element;
            elementText = text.trim();
            console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 클릭 대상 발견 - "${elementText}"`);
            break;
          }
        } catch (err) {
          // 요소 평가 실패 시 다음 요소로 계속
          continue;
        }
      }
      
      if (!foundElement) {
        console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 클릭 가능한 버튼을 찾을 수 없습니다. 플로우 종료.`);
        break;
      }
      
      // 현재 URL 저장 (변경 감지용)
      const currentUrl = page.url();
      
      // 버튼 클릭 실행
      try {
        await foundElement.click();
        console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 버튼 클릭 완료 - "${elementText}"`);
        
        // 네비게이션 또는 페이지 변화 대기
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil, timeout: 15000 }),
            page.waitForTimeout(2000) // 최소 2초 대기
          ]);
        } catch (navError) {
          console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 네비게이션 타임아웃, 페이지 변화 확인 중...`);
        }
        
        // URL 변경 확인
        const newUrl = page.url();
        if (newUrl !== currentUrl) {
          console.log(`[Flow Capture] 플로우 단계 ${flowStep}: URL 변경 감지 - ${newUrl}`);
        }
        
        // 페이지 스크롤 및 로딩 완료 대기
        await autoScroll(page);
        
        // 플로우 단계 스크린샷 촬영
        const flowScreenshot = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        const flowFilename = `flow_step_${flowStep}_${elementText.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`;
        zip.file(flowFilename, flowScreenshot);
        
        screenshots.push({
          url: newUrl,
          filename: flowFilename,
          success: true
        });
        
        console.log(`[Flow Capture] 플로우 단계 ${flowStep}: 스크린샷 캡처 완료 - ${flowFilename}`);
        
      } catch (clickError: any) {
        console.error(`[Flow Capture] 플로우 단계 ${flowStep}: 클릭 실패`, clickError.message);
        break;
      }
      
      flowStep++;
      
    } catch (error: any) {
      console.error(`[Flow Capture] 플로우 단계 ${flowStep}: 오류 발생`, error.message);
      break;
    }
  }
  
  console.log(`[Flow Capture] 플로우 캡처 완료: 총 ${flowStep - 1}단계 캡처됨`);
}

// 자동 스크롤 함수: lazy-load 이미지 포함하여 전체 콘텐츠 로딩
async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

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
