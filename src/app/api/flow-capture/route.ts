import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

interface FlowCaptureRequest {
  url: string;
  maxSteps?: number;
  triggerKeywords?: string[];
  waitTime?: number;
}

interface CaptureResult {
  screenshots: {
    step: number;
    title: string;
    url: string;
    buffer: string; // base64
    timestamp: string;
  }[];
  totalSteps: number;
  success: boolean;
  error?: string;
}

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

export async function POST(request: NextRequest) {
  try {
    console.log('[Flow Capture] API 호출 시작');
    
    const body: FlowCaptureRequest = await request.json();
    const { 
      url: rawUrl, 
      maxSteps = 5, 
      triggerKeywords = ['다음', '시작', 'Next', 'Start', 'Continue', '계속'], 
      waitTime = 3000 
    } = body;

    if (!rawUrl) {
      return NextResponse.json({ 
        error: 'URL이 필요합니다.' 
      }, { status: 400 });
    }

    // URL 정규화
    let url: string;
    try {
      url = normalizeUrl(rawUrl);
      console.log(`[Flow Capture] URL 정규화: ${rawUrl} → ${url}`);
    } catch (error) {
      console.error('[Flow Capture] URL 정규화 실패:', error);
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'URL 형식이 올바르지 않습니다.'
      }, { status: 400 });
    }

    console.log(`[Flow Capture] ${url} 플로우 캡처 시작 (최대 ${maxSteps}단계)`);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ],
      timeout: 60000
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const screenshots: CaptureResult['screenshots'] = [];

    try {
      // 첫 번째 페이지 로딩 및 캡처
      console.log(`[Flow Capture] 1단계: 초기 페이지 로딩 - ${url}`);
      
      // 더 관대한 로딩 전략
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
      } catch (error) {
        console.log(`[Flow Capture] 초기 로딩 실패, 재시도: ${error}`);
        await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 90000 
        });
      }
      
      await page.waitForTimeout(waitTime);

      const firstScreenshot = await page.screenshot({ 
        fullPage: true, 
        type: 'png' 
      });
      
      screenshots.push({
        step: 1,
        title: await page.title() || '첫 번째 페이지',
        url: page.url(),
        buffer: firstScreenshot.toString('base64'),
        timestamp: new Date().toISOString()
      });

      // 플로우 단계별 캡처
      for (let step = 2; step <= maxSteps; step++) {
        console.log(`[Flow Capture] ${step}단계: 트리거 버튼 찾기`);
        
        let clicked = false;
        
        // 키워드 기반 버튼/링크 찾기 및 클릭
        for (const keyword of triggerKeywords) {
          try {
            // 버튼 찾기
            const buttonSelector = `button:has-text("${keyword}"), input[type="button"]:has-text("${keyword}"), input[type="submit"]:has-text("${keyword}")`;
            const linkSelector = `a:has-text("${keyword}")`;
            
            let element = await page.locator(buttonSelector).first();
            if (await element.count() === 0) {
              element = await page.locator(linkSelector).first();
            }
            
            if (await element.count() > 0) {
              console.log(`[Flow Capture] ${step}단계: "${keyword}" 버튼/링크 클릭`);
              await element.click();
              clicked = true;
              break;
            }
          } catch (error) {
            console.log(`[Flow Capture] ${step}단계: "${keyword}" 버튼 클릭 실패:`, error);
            continue;
          }
        }

        if (!clicked) {
          console.log(`[Flow Capture] ${step}단계: 클릭 가능한 트리거를 찾을 수 없어 종료`);
          break;
        }

        // 페이지 변화 대기
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        } catch (error) {
          console.log(`[Flow Capture] ${step}단계: 페이지 로딩 대기 타임아웃, 계속 진행`);
        }
        
        await page.waitForTimeout(waitTime);

        // 스크린샷 촬영
        const screenshot = await page.screenshot({ 
          fullPage: true, 
          type: 'png' 
        });
        
        screenshots.push({
          step,
          title: await page.title() || `${step}번째 페이지`,
          url: page.url(),
          buffer: screenshot.toString('base64'),
          timestamp: new Date().toISOString()
        });

        console.log(`[Flow Capture] ${step}단계: 캡처 완료 - ${await page.title()}`);
      }

    } catch (error) {
      console.error('[Flow Capture] 캡처 프로세스 오류:', error);
      await browser.close();
      
      return NextResponse.json({
        success: false,
        error: `캡처 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
        screenshots,
        totalSteps: screenshots.length
      }, { status: 500 });
    }

    await browser.close();

    const result: CaptureResult = {
      screenshots,
      totalSteps: screenshots.length,
      success: true
    };

    console.log(`[Flow Capture] 완료: 총 ${screenshots.length}개 스크린샷 캡처됨`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Flow Capture] API 오류:', error);
    return NextResponse.json({
      success: false,
      error: `API 오류: ${error instanceof Error ? error.message : String(error)}`,
      screenshots: [],
      totalSteps: 0
    }, { status: 500 });
  }
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
