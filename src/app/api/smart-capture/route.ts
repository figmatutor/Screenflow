import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

interface SmartCaptureOptions {
  maxClicks?: number;
  clickDelay?: number;
  waitTimeout?: number;
  viewport?: { width: number; height: number };
  selectors?: string[];
  captureFullPage?: boolean;
  skipDuplicates?: boolean;
  compressionLevel?: number;
}

interface CaptureMetadata {
  filename: string;
  hash: string;
  selector?: string;
  elementInfo?: any;
  isDuplicate: boolean;
  timestamp: number;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  if (!request.body) {
    return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
  }

  try {
    const { url, options = {} }: { url: string; options?: SmartCaptureOptions } = await request.json();
    
    const {
      maxClicks = 5,
      clickDelay = 150,
      waitTimeout = 2000,
      viewport = { width: 1280, height: 720 },
      selectors = ['a[href]', 'button', '[role="button"]', '[onclick]', '[data-action]'],
      captureFullPage = true,
      skipDuplicates = true,
      compressionLevel = 9
    } = options;

    if (!url) {
      return NextResponse.json({ error: 'URL이 제공되지 않았습니다.' }, { status: 400 });
    }

    const sessionId = uuidv4();
    console.log(`[Smart Capture] 시작: ${url} (sessionId: ${sessionId})`);
    console.log(`[Smart Capture] 옵션: maxClicks=${maxClicks}, skipDuplicates=${skipDuplicates}`);

    let browser = null;
    const capturedHashes = new Set<string>();
    const clickedElements = new Set<string>();
    const captureMetadata: CaptureMetadata[] = [];
    let index = 0;

    try {
      // Puppeteer 브라우저 실행
      browser = await launchBrowser(viewport);
      const page = await browser.newPage();
      
      // Anti-detection 설정
      await setupAntiDetection(page);
      
      // 페이지 오류 이벤트 리스너
      page.on('pageerror', (error) => {
        console.error(`[Smart Capture] 페이지 오류:`, error.message);
      });
      
      page.on('requestfailed', (request) => {
        console.warn(`[Smart Capture] 요청 실패:`, request.url(), request.failure()?.errorText);
      });

      console.log(`[Smart Capture] 메인 페이지 로드: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.setViewport(viewport);

      // ZIP 생성
      const zip = new JSZip();

      // 스마트 캡처 함수 (중복 제거 포함)
      const captureIfUnique = async (description: string = '', selector?: string, elementInfo?: any) => {
        try {
          console.log(`[Smart Capture] 스크린샷 시도 ${index + 1}: ${description}`);
          
          const screenshotBuffer = await page.screenshot({ 
            fullPage: captureFullPage,
            type: 'png'
          });
          
          // SHA-1 해시 생성
          const hash = crypto.createHash('sha1').update(screenshotBuffer).digest('hex');
          
          if (skipDuplicates && capturedHashes.has(hash)) {
            console.log(`[Smart Capture] ⚠️ 중복 스크린샷 스킵: ${hash.substring(0, 8)}... - ${description}`);
            
            captureMetadata.push({
              filename: '',
              hash,
              selector,
              elementInfo,
              isDuplicate: true,
              timestamp: Date.now(),
              success: true
            });
            
            return false; // 중복임을 알림
          }
          
          // 유니크한 스크린샷 저장
          capturedHashes.add(hash);
          const filename = `screen-${String(index).padStart(3, '0')}.png`;
          zip.file(filename, screenshotBuffer);
          
          captureMetadata.push({
            filename,
            hash,
            selector,
            elementInfo,
            isDuplicate: false,
            timestamp: Date.now(),
            success: true
          });
          
          console.log(`[Smart Capture] ✅ 유니크 스크린샷 캡처: ${filename} (${screenshotBuffer.length} bytes, hash: ${hash.substring(0, 8)}...) - ${description}`);
          index++;
          
          return true; // 새로운 캡처임을 알림
          
        } catch (error: any) {
          console.error(`[Smart Capture] 캡처 실패: ${description}`, error.message);
          
          captureMetadata.push({
            filename: '',
            hash: '',
            selector,
            elementInfo,
            isDuplicate: false,
            timestamp: Date.now(),
            success: false,
            error: error.message
          });
          
          return false;
        }
      };

      // 초기 페이지 캡처
      await captureIfUnique('초기 메인 페이지');

      // 각 선택자별로 클릭 가능한 요소들 탐색 및 캡처
      let totalClicks = 0;
      for (const selector of selectors) {
        if (totalClicks >= maxClicks) break;
        
        try {
          console.log(`[Smart Capture] 선택자 "${selector}" 요소들 탐색 중...`);
          
          const elements = await page.$$(selector);
          console.log(`[Smart Capture] "${selector}" 요소 ${elements.length}개 발견`);

          for (let i = 0; i < elements.length && totalClicks < maxClicks; i++) {
            try {
              const elementHandle = elements[i];
              
              // 요소의 outerHTML을 가져와서 중복 클릭 방지
              const outerHTML = await page.evaluate(el => el.outerHTML, elementHandle);
              const elementSignature = crypto.createHash('md5').update(outerHTML).digest('hex');
              
              if (clickedElements.has(elementSignature)) {
                console.log(`[Smart Capture] 이미 클릭한 요소 스킵: ${elementSignature.substring(0, 8)}...`);
                continue;
              }
              
              clickedElements.add(elementSignature);
              
              // 요소가 뷰포트에 보이는지 확인
              const isVisible = await elementHandle.isIntersectingViewport();
              if (!isVisible) {
                console.log(`[Smart Capture] 요소가 뷰포트에 보이지 않음, 스킵: ${selector}`);
                continue;
              }

              // 요소 정보 수집
              const elementInfo = await page.evaluate((el) => {
                return {
                  tagName: el.tagName,
                  textContent: (el.textContent || '').trim().substring(0, 100),
                  href: (el as HTMLAnchorElement).href || '',
                  className: el.className,
                  id: el.id,
                  title: el.title || '',
                  outerHTML: el.outerHTML.substring(0, 200) + (el.outerHTML.length > 200 ? '...' : '')
                };
              }, elementHandle);

              console.log(`[Smart Capture] 클릭 시도 ${totalClicks + 1}/${maxClicks}: ${selector}`);
              console.log(`[Smart Capture] 요소 정보:`, {
                tagName: elementInfo.tagName,
                textContent: elementInfo.textContent,
                href: elementInfo.href
              });

              // 현재 URL 저장
              const currentUrl = page.url();
              
              // 호버 후 클릭
              await elementHandle.hover();
              await page.waitForTimeout(clickDelay);
              
              await elementHandle.click({ delay: clickDelay });
              await page.waitForTimeout(waitTimeout);

              // 클릭 후 캡처 (중복 체크 포함)
              const wasUnique = await captureIfUnique(
                `클릭 후: ${selector} - "${elementInfo.textContent}"`,
                selector,
                elementInfo
              );

              totalClicks++;

              // 원래 페이지로 돌아가기
              const newUrl = page.url();
              if (newUrl !== currentUrl) {
                try {
                  console.log(`[Smart Capture] URL 변경 감지, 뒤로 가기: ${newUrl} → ${currentUrl}`);
                  await page.goBack({ waitUntil: 'networkidle2', timeout: 15000 });
                  await page.waitForTimeout(1000);
                } catch (backError) {
                  console.warn(`[Smart Capture] 뒤로 가기 실패, 원본 URL로 재로드`);
                  await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                }
              }

            } catch (clickError: any) {
              console.warn(`[Smart Capture] 클릭 실패: ${selector} 요소 ${i + 1} - ${clickError.message}`);
              continue;
            }
          }

        } catch (selectorError: any) {
          console.warn(`[Smart Capture] 선택자 "${selector}" 처리 실패: ${selectorError.message}`);
          continue;
        }
      }

      await browser.close();

      // 메타데이터 파일을 ZIP에 추가
      const metadata = {
        sessionId,
        url,
        timestamp: new Date().toISOString(),
        options,
        totalCaptures: captureMetadata.length,
        uniqueCaptures: captureMetadata.filter(m => !m.isDuplicate).length,
        duplicateSkipped: captureMetadata.filter(m => m.isDuplicate).length,
        totalClicks,
        captureDetails: captureMetadata
      };
      
      zip.file('capture-metadata.json', JSON.stringify(metadata, null, 2));

      // ZIP 파일 생성
      console.log(`[Smart Capture] ZIP 생성 중... (압축 레벨: ${compressionLevel})`);
      const zipBuffer = await zip.generateAsync({ 
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: compressionLevel }
      });
      
      console.log(`[Smart Capture] ZIP 생성 완료: ${zipBuffer.length} bytes`);
      
      // 결과 요약
      const uniqueCount = captureMetadata.filter(m => !m.isDuplicate && m.success).length;
      const duplicateCount = captureMetadata.filter(m => m.isDuplicate).length;
      const failureCount = captureMetadata.filter(m => !m.success).length;
      
      console.log(`[Smart Capture] 완료 요약:`);
      console.log(`  - 유니크 캡처: ${uniqueCount}개`);
      console.log(`  - 중복 스킵: ${duplicateCount}개`);
      console.log(`  - 실패: ${failureCount}개`);
      console.log(`  - 총 클릭: ${totalClicks}회`);

      // ZIP 파일 응답
      const baseUrl = new URL(url);
      const filename = `smart-capture-${baseUrl.hostname}-${sessionId.substring(0, 8)}.zip`;
      
      const blob = new Blob([zipBuffer.buffer], { type: 'application/zip' });
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'no-cache',
          'X-Total-Captures': uniqueCount.toString(),
          'X-Duplicates-Skipped': duplicateCount.toString(),
          'X-Total-Clicks': totalClicks.toString()
        }
      });

    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }

  } catch (error: any) {
    console.error('[Smart Capture] 전체 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Smart Capture 실행 중 오류가 발생했습니다.', 
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

  console.log(`[Smart Capture] 환경: ${isVercel ? 'Serverless' : 'Local'}`);
  console.log(`[Smart Capture] 뷰포트: ${viewport.width}x${viewport.height}`);

  if (isVercel) {
    const executablePath = await chromium.executablePath();
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
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    
    let executablePath = process.env.CHROME_EXECUTABLE_PATH;
    
    if (!executablePath) {
      for (const path of possiblePaths) {
        try {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`[Smart Capture] Chrome 경로 발견: ${path}`);
            break;
          }
        } catch (err) {
          // 경로 확인 실패 시 다음 경로 시도
        }
      }
    }
    
    if (!executablePath) {
      throw new Error('Chrome 실행 파일을 찾을 수 없습니다.');
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
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en'],
      });
    });

    console.log(`[Smart Capture] Anti-detection 설정 완료`);
  } catch (error: any) {
    console.warn(`[Smart Capture] Anti-detection 설정 중 오류: ${error.message}`);
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
