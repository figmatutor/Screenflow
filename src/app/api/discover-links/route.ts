import { NextRequest, NextResponse } from 'next/server';
import { LinkDiscovery } from '@/lib/link-discovery';
import { captureStore } from '@/lib/capture-store';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // 세션 ID 생성
    const sessionId = `discover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Discover API] 링크 발견 시작: ${url} (세션: ${sessionId})`);
    
    // 백그라운드에서 링크 발견 작업 시작
    captureStore.set(sessionId, { 
      status: 'processing',
      createdAt: new Date()
    });
    
    // 비동기로 링크 발견 실행
    startLinkDiscovery(url, sessionId);
    
    const responseData = {
      sessionId,
      baseUrl: url,
      status: 'processing',
      estimatedTime: 15000, // 15초 예상
      message: '페이지를 분석하고 링크를 수집하고 있습니다...'
    };

    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[Discover API] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

async function startLinkDiscovery(url: string, sessionId: string) {
  const discovery = new LinkDiscovery();
  
  try {
    console.log(`[Discover API] 링크 발견 시작: ${url} (세션: ${sessionId})`);
    
    const result = await discovery.discoverLinks(url, sessionId);
    
    captureStore.update(sessionId, {
      status: 'completed',
      result: {
        baseUrl: result.baseUrl,
        basePageTitle: result.basePageTitle,
        baseScreenshot: result.baseScreenshot,
        discoveredLinks: result.discoveredLinks,
        totalLinks: result.totalLinks,
        internalLinks: result.internalLinks
      }
    });
    
    console.log(`[Discover API] 링크 발견 완료: ${sessionId} - ${result.discoveredLinks.length}개 링크 발견`);
    
  } catch (error) {
    console.error(`[Discover API] 링크 발견 실패: ${sessionId}`, error);
    
    captureStore.update(sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  } finally {
    await discovery.close();
  }
}

// 링크 발견 상태 확인을 위한 GET 엔드포인트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    sessionId,
    status: captureInfo.status,
    ...(captureInfo.result && { 
      baseUrl: captureInfo.result.baseUrl,
      basePageTitle: captureInfo.result.basePageTitle,
      discoveredLinks: captureInfo.result.discoveredLinks,
      totalLinks: captureInfo.result.totalLinks,
      internalLinks: captureInfo.result.internalLinks
    }),
    ...(captureInfo.error && { error: captureInfo.error })
  });
}
