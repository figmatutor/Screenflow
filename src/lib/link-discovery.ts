import puppeteer, { Browser, Page } from 'puppeteer';

export interface DiscoveredLink {
  url: string;
  label: string;
  title?: string;
  text?: string;
  selector: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LinkDiscoveryResult {
  baseUrl: string;
  basePageTitle: string;
  baseScreenshot: Buffer;
  discoveredLinks: DiscoveredLink[];
  totalLinks: number;
  internalLinks: number;
  sessionId: string;
}

export class LinkDiscovery {
  private browser: Browser | null = null;
  private readonly timeout = 30000; // 30초

  async initialize(): Promise<void> {
    console.log(`[LinkDiscovery] 브라우저 초기화 시작`);
    
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        defaultViewport: null,
        // ignoreHTTPSErrors: true
      });
      
      console.log(`[LinkDiscovery] 브라우저 초기화 완료`);
      
    } catch (error) {
      console.error(`[LinkDiscovery] 브라우저 초기화 실패:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async discoverLinks(baseUrl: string, sessionId: string): Promise<LinkDiscoveryResult> {
    await this.initialize();
    if (!this.browser) throw new Error('Browser not initialized.');

    console.log(`[LinkDiscovery] 링크 수집 시작: ${baseUrl}`);

    const page = await this.browser.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log(`[LinkDiscovery] 페이지 로딩: ${baseUrl}`);
      await page.goto(baseUrl, { 
        waitUntil: 'networkidle2', 
        timeout: this.timeout 
      });
      
      // 추가 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 페이지 제목 추출
      const basePageTitle = await page.title().catch(() => 'Unknown Title');
      
      // 기본 페이지 스크린샷 캡처
      const baseScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      }) as Buffer;
      
      console.log(`[LinkDiscovery] 기본 페이지 캡처 완료: ${baseScreenshot.length} bytes`);
      
      // 링크 수집
      const baseUrlObj = new URL(baseUrl);
      const discoveredLinks = await this.extractLinks(page, baseUrlObj);
      
      console.log(`[LinkDiscovery] 총 ${discoveredLinks.length}개 내부 링크 발견`);
      
      return {
        baseUrl,
        basePageTitle,
        baseScreenshot,
        discoveredLinks,
        totalLinks: discoveredLinks.length,
        internalLinks: discoveredLinks.length,
        sessionId
      };

    } catch (error) {
      console.error(`[LinkDiscovery] 링크 수집 실패:`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private async extractLinks(page: Page, baseUrlObj: URL): Promise<DiscoveredLink[]> {
    console.log(`[LinkDiscovery] 링크 추출 중...`);
    
    const links = await page.evaluate((baseHost: string, baseOrigin: string) => {
      const discoveredLinks: any[] = [];
      
      // 모든 a 태그 수집
      const anchors = document.querySelectorAll('a[href]');
      
      anchors.forEach((anchor: Element, index: number) => {
        const link = anchor as HTMLAnchorElement;
        const href = link.href;
        const text = link.textContent?.trim() || '';
        const title = link.title || '';
        
        try {
          const linkUrl = new URL(href);
          
          // 내부 링크만 필터링 (동일 origin)
          if (linkUrl.origin !== baseOrigin) {
            return;
          }
          
          // 제외할 링크들
          if (
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href === '#' ||
            href === baseOrigin ||
            href === baseOrigin + '/' ||
            linkUrl.pathname === '/' && linkUrl.search === '' && linkUrl.hash === ''
          ) {
            return;
          }
          
          // 해시만 있는 링크 제외 (anchor 링크)
          if (linkUrl.pathname === new URL(baseOrigin).pathname && linkUrl.search === '' && linkUrl.hash) {
            return;
          }
          
          const rect = link.getBoundingClientRect();
          
          discoveredLinks.push({
            url: href,
            label: text || title || `링크 ${index + 1}`,
            title: title,
            text: text,
            selector: `a[href="${href}"]`,
            boundingBox: rect.width > 0 && rect.height > 0 ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            } : undefined
          });
        } catch (error) {
          // 잘못된 URL은 무시
          console.warn('Invalid URL:', href);
        }
      });
      
      return discoveredLinks;
    }, baseUrlObj.hostname, baseUrlObj.origin);
    
    // 중복 제거 (URL 기준)
    const uniqueLinks = this.deduplicateLinks(links);
    
    // 정렬 (텍스트가 있는 것 우선, 그 다음 URL 순)
    const sortedLinks = this.sortLinks(uniqueLinks);
    
    console.log(`[LinkDiscovery] ${links.length}개 링크 중 ${sortedLinks.length}개 유효 링크 추출`);
    
    return sortedLinks;
  }

  private deduplicateLinks(links: DiscoveredLink[]): DiscoveredLink[] {
    const seen = new Map<string, DiscoveredLink>();
    
    links.forEach(link => {
      const normalizedUrl = this.normalizeUrl(link.url);
      
      if (!seen.has(normalizedUrl)) {
        seen.set(normalizedUrl, {
          ...link,
          url: normalizedUrl
        });
      } else {
        // 이미 있는 링크의 라벨이 더 좋은지 확인
        const existing = seen.get(normalizedUrl)!;
        if (link.text && link.text.length > existing.text?.length) {
          seen.set(normalizedUrl, {
            ...link,
            url: normalizedUrl
          });
        }
      }
    });
    
    return Array.from(seen.values());
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 쿼리 파라미터와 프래그먼트는 유지하되, 정규화
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  private sortLinks(links: DiscoveredLink[]): DiscoveredLink[] {
    return links.sort((a, b) => {
      // 텍스트가 있는 것 우선
      if (a.text && !b.text) return -1;
      if (!a.text && b.text) return 1;
      
      // 텍스트가 긴 것 우선 (더 설명적)
      if (a.text && b.text) {
        if (a.text.length !== b.text.length) {
          return b.text.length - a.text.length;
        }
      }
      
      // URL 알파벳 순
      return a.url.localeCompare(b.url);
    });
  }

  private sanitizeFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      let name = urlObj.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      
      if (!name || name === '_') {
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
