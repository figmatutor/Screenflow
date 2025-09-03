import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './browser-launcher';
import sharp from 'sharp';

export interface CrawledPage {
  url: string;
  title: string;
  filename: string;
  fullScreenshot: Buffer;
  thumbnail: string; // base64 encoded thumbnail
  success: boolean;
  error?: string;
  capturedAt: Date;
  order: number;
  depth: number;
}

export interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  viewportWidth: number;
  viewportHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  waitAfterLoad: number;
}

export interface CrawlResult {
  baseUrl: string;
  crawledPages: CrawledPage[];
  totalPages: number;
  successCount: number;
  failureCount: number;
  sessionId: string;
}

export class AutoCaptureCrawler {
  private browser: Browser | null = null;
  private readonly timeout = 60000; // 30초 → 60초로 증가
  private readonly defaultOptions: CrawlOptions = {
    maxDepth: 1,
    maxPages: 5, // 페이지 수 제한
    viewportWidth: 1440, // 1440px로 증가
    viewportHeight: 900, // 비례적으로 증가
    thumbnailWidth: 300, // 더 큰 썸네일
    thumbnailHeight: 200,
    waitAfterLoad: 1000 // 더 짧은 대기시간
  };

  async initialize(): Promise<void> {
    console.log(`[AutoCaptureCrawler] 브라우저 초기화 시작`);
    console.log(`[AutoCaptureCrawler] 환경 변수:`, {
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      AWS_LAMBDA: process.env.AWS_LAMBDA_FUNCTION_NAME
    });
    
    try {
      this.browser = await launchBrowser();
      console.log(`[AutoCaptureCrawler] 브라우저 초기화 완료`);
    } catch (error) {
      console.error(`[AutoCaptureCrawler] 브라우저 초기화 실패:`, error);
      console.error(`[AutoCaptureCrawler] 오류 스택:`, error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`브라우저 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async crawlAndCapture(baseUrl: string, sessionId: string, options?: Partial<CrawlOptions>): Promise<CrawlResult> {
    await this.initialize();
    if (!this.browser) throw new Error('Browser not initialized.');

    const finalOptions = { ...this.defaultOptions, ...options };
    
    console.log(`[AutoCaptureCrawler v2.0] 크롤링 및 캡처 시작: ${baseUrl}`);
    console.log(`[AutoCaptureCrawler v2.0] 옵션:`, finalOptions);
    console.log(`[AutoCaptureCrawler v2.0] QUALITY 옵션 완전 제거됨 - 새 코드 실행 중`);

    const crawledPages: CrawledPage[] = [];
    const visitedUrls = new Set<string>();
    let orderCounter = 1;

    try {
      // 1. 첫 번째 우선순위: 입력된 기본 URL 캡처 (항상 1번째로)
      console.log(`[AutoCaptureCrawler] 1단계: 기본 페이지 캡처 시작: ${baseUrl}`);
      const initialPage = await this.capturePageAndExtractLinks(
        baseUrl, 
        orderCounter++, 
        0, 
        finalOptions
      );
      
      crawledPages.push(initialPage);
      visitedUrls.add(baseUrl);
      console.log(`[AutoCaptureCrawler] 1단계 완료: 기본 페이지 캡처 ${initialPage.success ? '성공' : '실패'} (${initialPage.title})`);

      if (!initialPage.success) {
        console.error(`[AutoCaptureCrawler] 🚨 기본 페이지 캡처 실패: ${initialPage.error}`);
        console.error(`[AutoCaptureCrawler] 기본 URL: ${baseUrl}`);
        
        // 기본 페이지 실패는 치명적 오류로 처리
        throw new Error(`기본 페이지 캡처 실패: ${initialPage.error || 'Unknown error'}`);
      }
      
      console.log(`[AutoCaptureCrawler] ✅ 기본 페이지 캡처 성공: ${initialPage.title}`);

      // 깊이가 0보다 큰 경우에만 추가 링크 캡처
      if (finalOptions.maxDepth > 0) {
        // 2. 내부 링크 탐색 및 추출
        console.log(`[AutoCaptureCrawler] 2단계: 내부 링크 탐색 시작`);
        const links = await this.extractInternalLinks(baseUrl);
        console.log(`[AutoCaptureCrawler] 2단계: ${links.length}개 내부 링크 발견`);

        if (links.length > 0) {
          // 3. 각 링크에 대해 순차적으로 캡처 수행 (depth 1)
          const remainingSlots = finalOptions.maxPages - 1; // 기본 페이지 제외
          console.log(`[AutoCaptureCrawler] 3단계: 하위 페이지 캡처 시작 (최대 ${remainingSlots}개)`);
          
          let capturedCount = 0;
          for (const link of links.slice(0, remainingSlots)) {
            if (visitedUrls.has(link) || crawledPages.length >= finalOptions.maxPages) {
              continue;
            }

            console.log(`[AutoCaptureCrawler] 하위 페이지 캡처 (${capturedCount + 1}/${Math.min(links.length, remainingSlots)}): ${link}`);
            
            const capturedPage = await this.capturePageAndExtractLinks(
              link,
              orderCounter++,
              1,
              finalOptions
            );
            
            crawledPages.push(capturedPage);
            visitedUrls.add(link);
            capturedCount++;
            
            console.log(`[AutoCaptureCrawler] 하위 페이지 캡처 ${capturedPage.success ? '성공' : '실패'}: ${capturedPage.title || capturedPage.error}`);
          }
          console.log(`[AutoCaptureCrawler] 3단계 완료: ${capturedCount}개 하위 페이지 캡처 완료`);
        } else {
          console.log(`[AutoCaptureCrawler] 추가 내부 링크가 없어 기본 페이지만 캡처됩니다.`);
        }
      } else {
        console.log(`[AutoCaptureCrawler] 깊이 설정이 0이므로 기본 페이지만 캡처합니다.`);
      }

      const successCount = crawledPages.filter(p => p.success).length;
      const failureCount = crawledPages.length - successCount;

      console.log(`[AutoCaptureCrawler] 최종 결과 정리:`);
      console.log(`[AutoCaptureCrawler] - 총 캡처 페이지: ${crawledPages.length}개`);
      console.log(`[AutoCaptureCrawler] - 성공: ${successCount}개`);
      console.log(`[AutoCaptureCrawler] - 실패: ${failureCount}개`);
      console.log(`[AutoCaptureCrawler] - 기본 페이지 포함 여부: ${crawledPages.find(p => p.order === 1) ? '포함됨' : '누락됨'}`);
      
      // 기본 페이지가 반드시 첫 번째에 있는지 확인
      const basePageExists = crawledPages.find(p => p.order === 1 && p.url === baseUrl);
      if (!basePageExists) {
        console.error(`[AutoCaptureCrawler] 치명적 오류: 기본 페이지(${baseUrl})가 캡처 결과에 없습니다!`);
      }

      console.log(`[AutoCaptureCrawler] 크롤링 완료: ${successCount}/${crawledPages.length} 성공`);

      return {
        baseUrl,
        crawledPages,
        totalPages: crawledPages.length,
        successCount,
        failureCount,
        sessionId
      };

    } catch (error) {
      console.error(`[AutoCaptureCrawler] 크롤링 실패:`, error);
      throw error;
    } finally {
      await this.close();
    }
  }

  private async capturePageAndExtractLinks(
    url: string, 
    order: number, 
    depth: number, 
    options: CrawlOptions
  ): Promise<CrawledPage> {
    const filename = `${order.toString().padStart(2, '0')}_${this.sanitizeFilename(url)}.png`;
    
    console.log(`[AutoCaptureCrawler] 캡처 시작 (${order}): ${url}`);
    console.log(`[AutoCaptureCrawler] Depth: ${depth}, Order: ${order}`);
    
    let page: Page | null = null;
    
    try {
      console.log(`[AutoCaptureCrawler] 새 페이지 생성 시작...`);
      page = await this.browser!.newPage();
      console.log(`[AutoCaptureCrawler] 새 페이지 생성 완료`);
      
      // 고정 viewport 설정
      console.log(`[AutoCaptureCrawler] viewport 설정: ${options.viewportWidth}x${options.viewportHeight}`);
      await page.setViewport({ 
        width: options.viewportWidth, 
        height: options.viewportHeight 
      });
      console.log(`[AutoCaptureCrawler] viewport 설정 완료`);
      
      // 페이지 로드 (더 관대한 설정)
      console.log(`[AutoCaptureCrawler] 페이지 로드 시작: ${url}`);
      
      // 페이지 오류 이벤트 리스너 추가
      page.on('pageerror', (error) => {
        console.error(`[AutoCaptureCrawler] 페이지 오류 (${url}):`, error.message);
      });
      
      page.on('requestfailed', (request) => {
        console.warn(`[AutoCaptureCrawler] 요청 실패 (${url}):`, request.url(), request.failure()?.errorText);
      });
      
      // 네트워크 연결 재시도 로직
      let lastError: Error | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`[AutoCaptureCrawler] 페이지 로드 시도 ${retryCount + 1}/${maxRetries}: ${url}`);
          
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: this.timeout 
          });
          
          // 성공하면 루프 탈출
          console.log(`[AutoCaptureCrawler] 페이지 로드 성공: ${url}`);
          break;
          
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          
          console.log(`[AutoCaptureCrawler] 페이지 로드 실패 (시도 ${retryCount}/${maxRetries}): ${lastError.message}`);
          
          if (retryCount < maxRetries) {
            // 재시도 전 잠시 대기
            const delay = Math.min(1000 * retryCount, 3000); // 1초, 2초, 3초
            console.log(`[AutoCaptureCrawler] ${delay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // 모든 재시도 실패 시 에러 발생
      if (retryCount >= maxRetries && lastError) {
        throw lastError;
      }
      console.log(`[AutoCaptureCrawler] 페이지 로드 완료: ${url}`);
      
      // 추가 로딩 대기
      console.log(`[AutoCaptureCrawler] 추가 로딩 대기: ${options.waitAfterLoad}ms`);
      await new Promise(resolve => setTimeout(resolve, options.waitAfterLoad));
      console.log(`[AutoCaptureCrawler] 추가 로딩 대기 완료`);
      
      // 페이지 제목 추출
      console.log(`[AutoCaptureCrawler] 페이지 제목 추출 시작`);
      const pageTitle = await page.title().catch(() => 'Unknown Title');
      console.log(`[AutoCaptureCrawler] 페이지 제목: "${pageTitle}"`);
      
      // 전체 페이지 스크린샷 캡처 (최적화됨) v2.0
      console.log(`[AutoCaptureCrawler] 스크린샷 캡처 시작 v2.0 (${order}): ${url}`);
      const fullScreenshot = await page.screenshot({
        fullPage: true, // 전체 페이지 캡처
        type: 'png',
        // clip 옵션 제거하여 실제 뷰포트 크기(1440x900) 사용
      }) as Buffer;
      console.log(`[AutoCaptureCrawler] 스크린샷 캡처 완료: ${fullScreenshot.length} bytes`);
      
      // 스크린샷 검증
      if (!fullScreenshot || fullScreenshot.length === 0) {
        throw new Error('스크린샷 캡처 실패: 빈 이미지 데이터');
      }
      
      console.log(`[AutoCaptureCrawler] 스크린샷 캡처 성공 (${order}): ${fullScreenshot.length} bytes`);
      
      // 썸네일 생성
      console.log(`[AutoCaptureCrawler] 썸네일 생성 시작 (${order})`);
      const thumbnail = await this.generateThumbnail(
        fullScreenshot, 
        options.thumbnailWidth, 
        options.thumbnailHeight
      );
      
      if (!thumbnail) {
        console.warn(`[AutoCaptureCrawler] 썸네일 생성 실패 (${order}), 빈 썸네일 사용`);
      } else {
        console.log(`[AutoCaptureCrawler] 썸네일 생성 완료 (${order}): ${thumbnail.length} chars`);
      }
      
      console.log(`[AutoCaptureCrawler] 캡처 완료 (${order}): ${url} - 원본: ${fullScreenshot.length}bytes, 썸네일: ${thumbnail ? 'OK' : 'FAIL'}`);
      
      return {
        url,
        title: pageTitle,
        filename,
        fullScreenshot,
        thumbnail,
        success: true,
        capturedAt: new Date(),
        order,
        depth
      };
      
    } catch (error) {
      console.error(`[AutoCaptureCrawler] 캡처 실패 (${order}): ${url}`, error);
      
      return {
        url,
        title: 'Error',
        filename,
        fullScreenshot: Buffer.alloc(0),
        thumbnail: '',
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        capturedAt: new Date(),
        order,
        depth
      };
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async extractInternalLinks(baseUrl: string): Promise<string[]> {
    const page = await this.browser!.newPage();
    
    try {
      // 더 관대한 네트워크 로딩 전략
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (error) {
        console.log(`[AutoCaptureCrawler] 첫 번째 시도 실패, 재시도: ${error}`);
        await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
      }
      
      const baseUrlObj = new URL(baseUrl);
      
      const links = await page.evaluate((baseOrigin: string) => {
        const anchors = document.querySelectorAll('a[href]');
        const internalLinks: string[] = [];
        
        anchors.forEach((anchor: Element) => {
          const link = anchor as HTMLAnchorElement;
          const href = link.href;
          
          try {
            const linkUrl = new URL(href);
            
            // 내부 링크만 필터링
            if (linkUrl.origin === baseOrigin &&
                !href.startsWith('javascript:') &&
                !href.startsWith('mailto:') &&
                !href.startsWith('tel:') &&
                href !== '#' &&
                linkUrl.pathname !== '/' || linkUrl.search || linkUrl.hash) {
              internalLinks.push(href);
            }
          } catch {
            // 잘못된 URL은 무시
          }
        });
        
        return internalLinks;
      }, baseUrlObj.origin);
      
      // 중복 제거 및 정규화
      const uniqueLinks = Array.from(new Set(links.map(link => {
        try {
          return new URL(link).toString();
        } catch {
          return link;
        }
      })));
      
      return uniqueLinks;
      
    } finally {
      await page.close();
    }
  }

  private async generateThumbnail(imageBuffer: Buffer, width: number, height: number): Promise<string> {
    try {
      console.log(`[AutoCaptureCrawler] 썸네일 생성 시작: 원본 ${imageBuffer.length} bytes → ${width}x${height}`);
      
      // 이미지 메타데이터 확인
      const metadata = await sharp(imageBuffer).metadata();
      console.log(`[AutoCaptureCrawler] 원본 이미지 정보: ${metadata.width}x${metadata.height}, 포맷: ${metadata.format}`);
      
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: false, // 작은 이미지도 확대하여 일관성 유지
          background: { r: 255, g: 255, b: 255, alpha: 1 } // 투명 배경을 흰색으로
        })
        .jpeg({ 
          quality: 85, // JPEG로 변경하여 파일 크기 최적화
          progressive: true 
        })
        .toBuffer();
      
      const base64String = thumbnailBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64String}`;
      
      console.log(`[AutoCaptureCrawler] 썸네일 생성 완료: ${thumbnailBuffer.length} bytes → base64 ${base64String.length} chars`);
      
      return dataUrl;
    } catch (error) {
      console.error('[AutoCaptureCrawler] 썸네일 생성 실패:', error);
      console.error('[AutoCaptureCrawler] 원본 버퍼 정보:', {
        length: imageBuffer.length,
        isBuffer: Buffer.isBuffer(imageBuffer),
        firstBytes: imageBuffer.slice(0, 10).toString('hex')
      });
      
      // 실패 시 기본 SVG 이미지 반환
      return this.generateFallbackThumbnail(width, height);
    }
  }

  private generateFallbackThumbnail(width: number, height: number): string {
    // SVG 기반 fallback 썸네일 생성
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1f2937"/>
        <g transform="translate(${width/2}, ${height/2})">
          <rect x="-20" y="-20" width="40" height="40" fill="#374151" rx="4"/>
          <path d="M-12,-8 L-12,8 L12,8 L12,-8 Z M-8,-4 L8,-4 L8,4 L-8,4 Z" fill="#6b7280"/>
          <circle cx="4" cy="-2" r="2" fill="#9ca3af"/>
        </g>
        <text x="50%" y="85%" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="12">이미지 없음</text>
      </svg>
    `;
    
    const base64Svg = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64Svg}`;
  }

  private sanitizeFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      let name = urlObj.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      
      if (!name || name === '_') {
        name = urlObj.hostname.replace(/[^a-zA-Z0-9_-]/g, '');
      }
      
      if (!name) {
        name = 'page';
      }
      
      // 파일명 길이 제한
      if (name.length > 50) {
        name = name.substring(0, 50);
      }
      
      return name;
    } catch {
      return 'page';
    }
  }
}
