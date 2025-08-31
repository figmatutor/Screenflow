import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

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

interface SiteMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
  category?: string;
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

    console.log(`[Recommend Sites] ${url} 메타데이터 분석 시작`);

    // 입력 URL의 메타데이터 추출
    const metadata = await extractMetadata(url);
    if (!metadata) {
      return NextResponse.json({ 
        error: '메타데이터를 추출할 수 없습니다.' 
      }, { status: 400 });
    }

    console.log(`[Recommend Sites] 추출된 메타데이터:`, metadata);

    // 유사 사이트 추천 (실제로는 외부 API나 DB를 사용하겠지만, 여기서는 샘플 데이터 사용)
    const recommendations = await generateRecommendations(metadata);

    return NextResponse.json({
      success: true,
      inputSite: {
        url,
        metadata
      },
      recommendations,
      total: recommendations.length
    });

  } catch (error) {
    console.error('[Recommend Sites] 오류:', error);
    return NextResponse.json({
      error: '사이트 추천 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function extractMetadata(url: string): Promise<SiteMetadata | null> {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-extensions',
      '--no-first-run',
      '--single-process'
    ],
    timeout: 60000
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 더 관대한 로딩 전략
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      console.log(`[Extract Metadata] 첫 번째 시도 실패, 재시도: ${error}`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    const metadata = await page.evaluate(() => {
      const getMetaContent = (name: string) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta?.getAttribute('content') || '';
      };

      const title = document.title || '';
      const description = getMetaContent('description') || getMetaContent('og:description');
      const keywords = getMetaContent('keywords').split(',').map(k => k.trim()).filter(k => k);
      const ogTitle = getMetaContent('og:title');
      const ogDescription = getMetaContent('og:description');
      
      // 카테고리 추론 (URL, 타이틀, 설명에서)
      const content = (title + ' ' + description).toLowerCase();
      let category = '기타';
      
      if (content.includes('쇼핑') || content.includes('구매') || content.includes('상품')) category = '쇼핑';
      else if (content.includes('뉴스') || content.includes('기사')) category = '뉴스';
      else if (content.includes('교육') || content.includes('학습')) category = '교육';
      else if (content.includes('게임')) category = '게임';
      else if (content.includes('영화') || content.includes('동영상')) category = '엔터테인먼트';
      else if (content.includes('금융') || content.includes('은행')) category = '금융';
      else if (content.includes('여행') || content.includes('호텔')) category = '여행';
      else if (content.includes('음식') || content.includes('레스토랑')) category = '음식';

      return {
        title,
        description,
        keywords,
        ogTitle,
        ogDescription,
        category
      };
    });

    await browser.close();
    return metadata;

  } catch (error) {
    console.error('[Extract Metadata] 오류:', error);
    await browser.close();
    return null;
  }
}

async function generateRecommendations(metadata: SiteMetadata): Promise<RecommendedSite[]> {
  // 실제 환경에서는 외부 API나 DB를 사용하겠지만, 여기서는 카테고리별 샘플 사이트 제공
  const sampleSites: Record<string, RecommendedSite[]> = {
    '쇼핑': [
      { url: 'https://www.coupang.com', title: '쿠팡', description: '로켓배송으로 빠른 쇼핑', tags: ['쇼핑', '배송', '전자상거래'], similarity: 0.95 },
      { url: 'https://www.11st.co.kr', title: '11번가', description: '다양한 상품과 혜택', tags: ['쇼핑', '할인', '온라인몰'], similarity: 0.88 },
      { url: 'https://www.gmarket.co.kr', title: 'G마켓', description: '글로벌 쇼핑 플랫폼', tags: ['쇼핑', '글로벌', '마켓플레이스'], similarity: 0.82 },
      { url: 'https://shopping.naver.com', title: '네이버 쇼핑', description: '네이버의 쇼핑 서비스', tags: ['쇼핑', '검색', '비교'], similarity: 0.79 }
    ],
    '뉴스': [
      { url: 'https://www.chosun.com', title: '조선일보', description: '대한민국 대표 일간지', tags: ['뉴스', '정치', '경제'], similarity: 0.92 },
      { url: 'https://www.donga.com', title: '동아일보', description: '동아일보 공식 사이트', tags: ['뉴스', '사회', '문화'], similarity: 0.89 },
      { url: 'https://www.joongang.co.kr', title: '중앙일보', description: '중앙일보 온라인', tags: ['뉴스', '종합', '미디어'], similarity: 0.85 },
      { url: 'https://www.yna.co.kr', title: '연합뉴스', description: '대한민국 대표 통신사', tags: ['뉴스', '통신', '속보'], similarity: 0.83 }
    ],
    '교육': [
      { url: 'https://www.coursera.org', title: 'Coursera', description: '온라인 강의 플랫폼', tags: ['교육', '강의', '온라인'], similarity: 0.94 },
      { url: 'https://www.edx.org', title: 'edX', description: '무료 온라인 교육', tags: ['교육', '무료', '대학'], similarity: 0.91 },
      { url: 'https://www.khan-academy.org', title: 'Khan Academy', description: '무료 온라인 학습', tags: ['교육', '무료', '기초학습'], similarity: 0.87 },
      { url: 'https://www.udemy.com', title: 'Udemy', description: '실무 중심 온라인 강의', tags: ['교육', '실무', '기술'], similarity: 0.84 }
    ],
    '기타': [
      { url: 'https://www.google.com', title: 'Google', description: '세계 최대 검색엔진', tags: ['검색', '정보', '글로벌'], similarity: 0.75 },
      { url: 'https://www.youtube.com', title: 'YouTube', description: '동영상 공유 플랫폼', tags: ['동영상', '엔터테인먼트', '소셜'], similarity: 0.72 },
      { url: 'https://www.facebook.com', title: 'Facebook', description: '소셜 네트워킹 서비스', tags: ['소셜', '네트워킹', '커뮤니티'], similarity: 0.69 },
      { url: 'https://www.instagram.com', title: 'Instagram', description: '사진 공유 SNS', tags: ['사진', 'SNS', '소셜미디어'], similarity: 0.66 }
    ]
  };

  const categoryRecommendations = sampleSites[metadata.category] || sampleSites['기타'];
  
  // 키워드 기반 유사도 조정
  if (metadata.keywords.length > 0) {
    categoryRecommendations.forEach(site => {
      const matchingKeywords = site.tags.filter(tag => 
        metadata.keywords.some(keyword => 
          keyword.toLowerCase().includes(tag.toLowerCase()) || 
          tag.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      // 매칭되는 키워드에 따라 유사도 조정
      site.similarity += matchingKeywords.length * 0.05;
      site.similarity = Math.min(site.similarity, 1.0);
    });
  }

  // 유사도 순으로 정렬하고 상위 4-5개 반환
  return categoryRecommendations
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
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
