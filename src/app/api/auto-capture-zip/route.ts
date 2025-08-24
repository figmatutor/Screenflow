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
      waitUntil = 'networkidle2' // 더 안정적인 로딩 대기
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

          // 현재 페이지에서 추가 링크 수집 (depth 확장)
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
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
