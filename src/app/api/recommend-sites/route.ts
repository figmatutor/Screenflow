import { NextRequest, NextResponse } from 'next/server';

// URL 정규화 함수
function normalizeUrl(inputUrl: string): string {
  let normalizedUrl = inputUrl.trim();
  
  // 프로토콜이 없으면 https:// 추가
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  // URL 유효성 검사
  try {
    const urlObj = new URL(normalizedUrl);
    return urlObj.toString();
  } catch (error) {
    throw new Error(`잘못된 URL 형식입니다: ${inputUrl}`);
  }
}

interface RecommendedSite {
  url: string;
  title: string;
  description: string;
  tags: string[];
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Recommend Sites] API 호출 시작');
    
    const body = await request.json();
    const { url: rawUrl } = body;

    if (!rawUrl) {
      return NextResponse.json({ 
        error: 'URL이 필요합니다.' 
      }, { status: 400 });
    }

    // URL 정규화 및 유효성 검사
    let url: string;
    try {
      url = normalizeUrl(rawUrl);
      console.log(`[Recommend Sites] URL 정규화: ${rawUrl} → ${url}`);
    } catch (error) {
      console.error('[Recommend Sites] URL 정규화 실패:', error);
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'URL 형식이 올바르지 않습니다.'
      }, { status: 400 });
    }

    console.log(`[Recommend Sites] ${url} 분석 시작`);

    // 도메인 기반 간단한 추천 시스템
    const recommendations = generateSimpleRecommendations(url);

    return NextResponse.json({
      success: true,
      url,
      recommendations,
      total: recommendations.length,
      message: '사이트 추천이 완료되었습니다.'
    });

  } catch (error) {
    console.error('[Recommend Sites] 오류:', error);
    return NextResponse.json({ 
      error: '사이트 추천 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 간단한 도메인 기반 추천 시스템
function generateSimpleRecommendations(url: string): RecommendedSite[] {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // 도메인별 추천 사이트 매핑
    const domainRecommendations: Record<string, RecommendedSite[]> = {
      'naver.com': [
        {
          url: 'https://www.google.com',
          title: 'Google',
          description: '전 세계에서 가장 많이 사용되는 검색 엔진',
          tags: ['검색', '포털', '웹서비스'],
          similarity: 0.85
        },
        {
          url: 'https://www.daum.net',
          title: 'Daum',
          description: '한국의 대표적인 포털 사이트',
          tags: ['포털', '뉴스', '검색'],
          similarity: 0.90
        },
        {
          url: 'https://www.yahoo.com',
          title: 'Yahoo',
          description: '글로벌 포털 및 검색 서비스',
          tags: ['포털', '검색', '뉴스'],
          similarity: 0.80
        }
      ],
      'google.com': [
        {
          url: 'https://www.naver.com',
          title: 'Naver',
          description: '한국 최대 검색 포털',
          tags: ['검색', '포털', '한국'],
          similarity: 0.85
        },
        {
          url: 'https://www.bing.com',
          title: 'Bing',
          description: 'Microsoft의 검색 엔진',
          tags: ['검색', 'Microsoft'],
          similarity: 0.80
        },
        {
          url: 'https://duckduckgo.com',
          title: 'DuckDuckGo',
          description: '프라이버시 중심 검색 엔진',
          tags: ['검색', '프라이버시'],
          similarity: 0.75
        }
      ],
      'github.com': [
        {
          url: 'https://gitlab.com',
          title: 'GitLab',
          description: '웹 기반 Git 저장소 관리 서비스',
          tags: ['개발', 'Git', '협업'],
          similarity: 0.90
        },
        {
          url: 'https://bitbucket.org',
          title: 'Bitbucket',
          description: 'Atlassian의 Git 저장소 서비스',
          tags: ['개발', 'Git', 'Atlassian'],
          similarity: 0.85
        },
        {
          url: 'https://stackoverflow.com',
          title: 'Stack Overflow',
          description: '개발자 질문답변 커뮤니티',
          tags: ['개발', '질문답변', '커뮤니티'],
          similarity: 0.70
        }
      ]
    };

    // 도메인에 맞는 추천 사이트 반환
    for (const [key, sites] of Object.entries(domainRecommendations)) {
      if (domain.includes(key)) {
        return sites;
      }
    }

    // 기본 추천 사이트들
    return [
      {
        url: 'https://www.google.com',
        title: 'Google',
        description: '전 세계 최대 검색 엔진',
        tags: ['검색', '웹서비스'],
        similarity: 0.60
      },
      {
        url: 'https://www.wikipedia.org',
        title: 'Wikipedia',
        description: '자유 백과사전',
        tags: ['정보', '백과사전', '지식'],
        similarity: 0.55
      },
      {
        url: 'https://www.youtube.com',
        title: 'YouTube',
        description: '동영상 공유 플랫폼',
        tags: ['동영상', '엔터테인먼트'],
        similarity: 0.50
      }
    ];

  } catch (error) {
    console.error('[Recommend Sites] URL 파싱 오류:', error);
    return [];
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