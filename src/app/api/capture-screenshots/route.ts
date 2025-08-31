import { NextRequest, NextResponse } from 'next/server';
import { launchBrowser } from '@/lib/browser-launcher';
import { sessionStore, type Screenshot, type CaptureSession } from '@/lib/session-store';

export async function POST(request: NextRequest) {
  try {
    console.log('[Capture Screenshots] API 호출 시작');
    
    const body = await request.json();
    const { sessionId, urls } = body;

    if (!sessionId || !urls || !Array.isArray(urls)) {
      return NextResponse.json({ 
        error: 'sessionId와 urls 배열이 필요합니다.' 
      }, { status: 400 });
    }

    console.log(`[Capture Screenshots] 세션 ${sessionId}: ${urls.length}개 URL 캡처 시작`);

    // 세션 초기화
    sessionStore.set(sessionId, {
      status: 'processing',
      progress: 0,
      total: urls.length,
      screenshots: []
    });

    // 백그라운드에서 캡처 진행
    captureScreenshotsAsync(sessionId, urls);

    return NextResponse.json({
      success: true,
      sessionId,
      message: '스크린샷 캡처가 시작되었습니다.',
      total: urls.length
    });

  } catch (error) {
    console.error('[Capture Screenshots] 오류:', error);
    return NextResponse.json({
      error: '스크린샷 캡처 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 스크린샷 메타데이터만 반환 (buffer 제외)
    const screenshots = session.screenshots.map(({ buffer, ...meta }) => ({
      ...meta,
      hasBuffer: buffer ? true : false
    }));

    return NextResponse.json({
      success: true,
      sessionId,
      status: session.status,
      progress: session.progress,
      total: session.total,
      screenshots,
      error: session.error
    });

  } catch (error) {
    console.error('[Capture Screenshots Status] 오류:', error);
    return NextResponse.json({
      error: '상태 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function captureScreenshotsAsync(sessionId: string, urls: string[]) {
  let browser;
  const session = sessionStore.get(sessionId);
  if (!session) return;

  try {
    console.log(`[Capture Screenshots] ${sessionId}: 브라우저 시작`);
    browser = await launchBrowser();

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[Capture Screenshots] ${sessionId}: ${i + 1}/${urls.length} - ${url}`);

      try {
        const page = await browser.newPage();
        
        // 데스크톱 해상도로 뷰포트 설정 (완전한 레이아웃 렌더링)
        await page.setViewport({ 
          width: 1920, 
          height: 1080,
          deviceScaleFactor: 1
        });

        // Bot Detection 방지
        await setupAntiDetection(page);

        // 페이지 이동 (모든 리소스 로딩 완료까지 대기)
        await page.goto(url, { 
          waitUntil: 'networkidle0', // 네트워크 요청이 500ms 동안 없을 때까지 대기
          timeout: 60000 
        });

        // CSS 로딩 완료 대기
        await waitForCSSLoading(page);

        // 추가 렌더링 대기 (폰트, 이미지 등)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 자동 스크롤 (lazy load 컨텐츠 로딩)
        await autoScroll(page);

        // 최종 렌더링 완료 대기
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 스크린샷 촬영 (전체 페이지, 고품질)
        const buffer = await page.screenshot({ 
          fullPage: true,
          type: 'png',
          quality: 90
        });

        const filename = `screenshot_${i + 1}.png`;
        console.log(`[Capture Screenshots] ${sessionId}: 캡처 성공 (${buffer.length}바이트): ${url} → ${filename}`);

        // 세션에 저장
        session.screenshots.push({
          url,
          filename,
          buffer,
          size: buffer.length
        });

        session.progress = i + 1;
        await page.close();

      } catch (error) {
        console.error(`[Capture Screenshots] ${sessionId}: 캡처 실패 ${url}:`, error);
        
        // 실패한 경우에도 빈 스크린샷으로 추가 (인덱스 유지)
        session.screenshots.push({
          url,
          filename: `screenshot_${i + 1}_failed.png`,
          buffer: Buffer.alloc(0),
          size: 0
        });

        session.progress = i + 1;
      }
    }

    session.status = 'completed';
    console.log(`[Capture Screenshots] ${sessionId}: 모든 캡처 완료`);

  } catch (error) {
    console.error(`[Capture Screenshots] ${sessionId}: 전체 프로세스 오류:`, error);
    session.status = 'failed';
    session.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function setupAntiDetection(page: any) {
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en'] });
  });

  // 요청 차단 설정 (CSS, 이미지, 폰트는 허용하고 분석 도구만 차단)
  await page.setRequestInterception(true);
  page.on('request', (request: any) => {
    try {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // 분석 도구와 광고만 차단, CSS/이미지/폰트는 허용
      if (url.includes('analytics') || url.includes('gtag') || url.includes('facebook') ||
          url.includes('google-analytics') || url.includes('doubleclick') ||
          url.includes('googlesyndication') || url.includes('adsystem') ||
          url.includes('advertising') || url.includes('ads.') || url.includes('.ads/')) {
        request.abort();
      } else {
        request.continue();
      }
    } catch (error) {
      try {
        request.continue();
      } catch (e) {
        // Request already handled
      }
    }
  });
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          // 스크롤 완료 후 추가 대기 (lazy load 이미지 등)
          setTimeout(resolve, 1000);
        }
      }, 100);
    });
  });
}

// CSS 로딩 완료 대기 함수
async function waitForCSSLoading(page: any) {
  await page.evaluate(async () => {
    // 모든 CSS 파일이 로드될 때까지 대기
    const sheets = Array.from(document.styleSheets);
    await Promise.all(
      sheets.map(sheet => {
        return new Promise((resolve) => {
          if (sheet.href) {
            const link = document.querySelector(`link[href="${sheet.href}"]`);
            if (link) {
              if ((link as any).complete) {
                resolve(true);
              } else {
                link.addEventListener('load', () => resolve(true));
                link.addEventListener('error', () => resolve(true));
              }
            } else {
              resolve(true);
            }
          } else {
            resolve(true);
          }
        });
      })
    );
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
