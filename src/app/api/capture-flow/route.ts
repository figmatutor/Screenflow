import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { launchBrowser } from '@/lib/browser-launcher';

interface CaptureFlowOptions {
  maxClicks?: number;
  timeout?: number;
  bufferTime?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { url, options = {} }: { url: string; options?: CaptureFlowOptions } = await request.json();
    
    const {
      maxClicks = 5,
      timeout = 15000,
      bufferTime = 1000
    } = options;

    if (!url) {
      return NextResponse.json(
        { error: 'URL이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    console.log(`[Capture Flow] 플로우 캡처 시작: ${url} (maxClicks: ${maxClicks})`);

    // Puppeteer 브라우저 실행
    const browser = await launchBrowser(1280, 720);
    const page = await browser.newPage();
    
    try {
      // Anti-detection 설정
      await setupAntiDetection(page);
      
      // 페이지 오류 이벤트 리스너
      page.on('pageerror', (error) => {
        console.error(`[Capture Flow] 페이지 오류:`, error.message);
      });
      
      page.on('requestfailed', (request) => {
        console.warn(`[Capture Flow] 요청 실패:`, request.url(), request.failure()?.errorText);
      });

      console.log(`[Capture Flow] 메인 페이지 로드: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      // ZIP 생성
      const zip = new JSZip();
      const screenshots: Array<{url: string, filename: string, success: boolean, error?: string}> = [];

      // 1. 메인 페이지 스크린샷
      console.log(`[Capture Flow] 메인 페이지 스크린샷 촬영`);
      const mainScreenshot = await page.screenshot({ 
        fullPage: true,
        type: 'png'
      });
      
      const mainFilename = '01-main.png';
      zip.file(mainFilename, mainScreenshot);
      screenshots.push({
        url,
        filename: mainFilename,
        success: true
      });
      
      console.log(`[Capture Flow] 메인 페이지 캡처 완료: ${mainScreenshot.length} bytes`);

      // 2. 클릭 가능한 링크 수집
      console.log(`[Capture Flow] 클릭 가능한 링크 수집 중...`);
      const clickableLinks = await page.$$eval('a[href]', (links) => 
        links
          .map(link => (link as HTMLAnchorElement).href)
          .filter(href => href && href.startsWith('http'))
      );

      const uniqueLinks = [...new Set(clickableLinks)].slice(0, maxClicks);
      console.log(`[Capture Flow] 발견된 링크 수: ${clickableLinks.length}, 캡처할 링크: ${uniqueLinks.length}`);
      uniqueLinks.forEach((link, i) => console.log(`  ${i + 1}. ${link}`));

      // 3. 각 링크 순차적으로 캡처
      let count = 2;
      for (const link of uniqueLinks) {
        try {
          console.log(`[Capture Flow] 링크 ${count - 1}/${uniqueLinks.length} 로드 중: ${link}`);
          
          await page.goto(link, { 
            waitUntil: 'domcontentloaded', 
            timeout 
          });
          
          // 버퍼 시간 대기
          await new Promise(resolve => setTimeout(resolve, bufferTime));
          
          console.log(`[Capture Flow] 스크린샷 촬영 중: ${link}`);
          const linkScreenshot = await page.screenshot({ 
            fullPage: true,
            type: 'png'
          });
          
          const filename = `${String(count).padStart(2, '0')}-page.png`;
          zip.file(filename, linkScreenshot);
          
          screenshots.push({
            url: link,
            filename,
            success: true
          });
          
          console.log(`[Capture Flow] 링크 캡처 성공: ${link} → ${filename} (${linkScreenshot.length} bytes)`);
          count++;
          
        } catch (err: any) {
          console.warn(`[Capture Flow] ❌ 링크 로드 실패: ${link}`, err.message);
          
          screenshots.push({
            url: link,
            filename: `${String(count).padStart(2, '0')}-failed.png`,
            success: false,
            error: err.message
          });
          count++;
        }
      }

      await browser.close();

      // 4. ZIP 생성
      console.log(`[Capture Flow] ZIP 파일 생성 중... (${screenshots.length}개 파일)`);
      const zipBuffer = await zip.generateAsync({ 
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      console.log(`[Capture Flow] ZIP 생성 완료: ${zipBuffer.length} bytes`);
      
      // 결과 요약
      const successCount = screenshots.filter(s => s.success).length;
      const failureCount = screenshots.filter(s => !s.success).length;
      console.log(`[Capture Flow] 완료 - 성공: ${successCount}, 실패: ${failureCount}`);

      // 5. ZIP 파일 응답
      const baseUrl = new URL(url);
      const filename = `capture-flow-${baseUrl.hostname}-${Date.now()}.zip`;
      
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
      await browser.close();
      throw error;
    }

  } catch (error: any) {
    console.error('[Capture Flow] 전체 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Capture Flow 실행 중 오류가 발생했습니다.', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
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
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // navigator.webdriver 숨기기
    await page.evaluateOnNewDocument(() => {
      // webdriver 속성 제거
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // 플러그인 정보 수정
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 언어 설정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    console.log('[Capture Flow] Anti-detection 설정 완료');
  } catch (error) {
    console.warn('[Capture Flow] Anti-detection 설정 실패:', error);
  }
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