import { NextRequest, NextResponse } from 'next/server';
import { launchBrowser } from '@/lib/browser-launcher';

export async function POST(request: NextRequest) {
  try {
    console.log('[Discover Links] API 호출 시작');
    
    const body = await request.json();
    const { url, maxLinks = 10 } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 });
    }

    console.log(`[Discover Links] URL 분석 시작: ${url}, 최대 링크: ${maxLinks}`);

    const browser = await launchBrowser();
    const page = await browser.newPage();

    // 기본 뷰포트 설정
    await page.setViewport({ width: 1280, height: 720 });

    // Bot Detection 방지 설정
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 페이지 이동
    console.log(`[Discover Links] 페이지 로딩: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // 기본 도메인 추출
    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname;

    console.log(`[Discover Links] 기본 도메인: ${baseDomain}`);

    // 내부 링크 수집
    const links = await page.evaluate((domain, currentUrl) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const uniqueLinks = new Set();
      
      anchors.forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        let fullUrl;
        try {
          // 상대 URL 처리
          if (href.startsWith('/')) {
            fullUrl = new URL(href, currentUrl).toString();
          } else if (href.startsWith('http')) {
            fullUrl = href;
          } else {
            fullUrl = new URL(href, currentUrl).toString();
          }

          const linkUrl = new URL(fullUrl);
          
          // 같은 도메인의 링크만 포함
          if (linkUrl.hostname === domain) {
            // URL 정규화 (query params와 hash 제거)
            const normalizedUrl = `${linkUrl.protocol}//${linkUrl.hostname}${linkUrl.pathname}`;
            uniqueLinks.add(normalizedUrl);
          }
        } catch (e) {
          // 잘못된 URL 무시
        }
      });

      return Array.from(uniqueLinks);
    }, baseDomain, url);

    await browser.close();

    // 메인 URL이 포함되지 않았다면 첫 번째에 추가
    const normalizedMainUrl = `${baseUrl.protocol}//${baseUrl.hostname}${baseUrl.pathname}`;
    const finalLinks = [normalizedMainUrl, ...links.filter(link => link !== normalizedMainUrl)]
      .slice(0, maxLinks);

    console.log(`[Discover Links] 발견된 링크 수: ${finalLinks.length}`);
    finalLinks.forEach((link, index) => {
      console.log(`[Discover Links] ${index + 1}. ${link}`);
    });

    return NextResponse.json({
      success: true,
      mainUrl: normalizedMainUrl,
      links: finalLinks,
      total: finalLinks.length,
      baseDomain
    });

  } catch (error) {
    console.error('[Discover Links] 오류:', error);
    return NextResponse.json({
      error: '링크 수집 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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