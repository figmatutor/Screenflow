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
    
    try {
      // 2. 링크 수집을 위한 초기 페이지 생성
      const initialPage = await browser.newPage();
      await initialPage.goto(url, { waitUntil, timeout });
      await autoScroll(initialPage); // 전체 콘텐츠 로딩

      console.log(`[Auto Capture ZIP] 메인 페이지 로드 및 스크롤 완료: ${url}`);

      // 하이퍼링크 수집 및 필터링 (동일 도메인만)
      const links = await initialPage.$$eval('a[href^="http"]', anchors =>
        anchors.map(a => a.href)
      );

      const internalLinks = Array.from(new Set(links))
        .filter(link => {
          try {
            const linkUrl = new URL(link);
            return linkUrl.hostname === baseUrl.hostname;
          } catch {
            return false;
          }
        });

      await initialPage.close();

      console.log(`[Auto Capture ZIP] 내부 링크 수집 완료: ${internalLinks.length}개`);
      internalLinks.forEach((link, i) => console.log(`  ${i + 1}. ${link}`));

      // 3. 각 링크별 스크린샷 캡처 (BFS 방식)
      const zip = new JSZip();
      const visited = new Set<string>();
      const screenshots: CaptureResult[] = [];
      const pagesToVisit = [{ url, index: 0 }];
      let count = 0;

      // 메인 페이지부터 시작해서 연관 링크들을 순회하며 캡처
      while (pagesToVisit.length > 0 && count < maxLinks) {
        const { url: targetUrl, index } = pagesToVisit.shift()!;
        
        if (visited.has(targetUrl)) continue;
        visited.add(targetUrl);

        console.log(`[Auto Capture ZIP] 캡처 시작 (${count + 1}/${maxLinks}): ${targetUrl}`);

        const newPage = await browser.newPage();
        try {
          await newPage.goto(targetUrl, { waitUntil, timeout });
          await autoScroll(newPage); // 전체 콘텐츠 로딩

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

          console.log(`[Auto Capture ZIP] 캡처 성공: ${targetUrl} → ${filename}`);

          // 플로우 캡처가 활성화된 경우 버튼 클릭 시퀀스 실행
          if (captureFlow) {
            await captureButtonFlow(newPage, zip, screenshots, flowKeywords, maxFlowSteps, targetUrl, count, timeout, waitUntil);
          }

          // 현재 페이지에서 추가 링크 수집 (depth 확장) - 플로우 캡처가 아닌 경우에만
          if (!captureFlow) {
            const pageLinks = await newPage.$$eval('a[href^="http"]', anchors =>
              anchors.map(a => a.href)
            );

            pageLinks.forEach((link, i) => {
              if (!visited.has(link) && 
                  new URL(link).hostname === baseUrl.hostname && 
                  !pagesToVisit.some(p => p.url === link)) {
                pagesToVisit.push({ url: link, index: count + i + 1 });
              }
            });
          }

          count++;
        } catch (error: any) {
          console.error(`[Auto Capture ZIP] 캡처 실패: ${targetUrl}`, error.message);
          screenshots.push({
            url: targetUrl,
            filename: `screenshot_${count + 1}.png`,
            success: false,
            error: error.message
          });
          count++;
        } finally {
          await newPage.close();
        }
      }

      await browser.close();

      // 4. ZIP 압축
      console.log(`[Auto Capture ZIP] ZIP 생성 시작: ${screenshots.length}개 파일`);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      console.log(`[Auto Capture ZIP] 완료: ${zipBuffer.length}바이트 ZIP 파일 생성`);
      
      // 성공/실패 요약
      const successCount = screenshots.filter(s => s.success).length;
      const failureCount = screenshots.filter(s => !s.success).length;
      console.log(`[Auto Capture ZIP] 결과: 성공 ${successCount}개, 실패 ${failureCount}개`);

      // 5. ZIP 파일 응답
      const filename = `screenshots-${baseUrl.hostname}-${Date.now()}.zip`;
      
      return new NextResponse(zipBuffer, {
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
      args: chromium.args,
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
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      timeout: 30000
    });
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
