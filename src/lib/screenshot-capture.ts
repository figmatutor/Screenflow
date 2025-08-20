import puppeteer, { Browser, Page } from 'puppeteer';
import JSZip from 'jszip';

export interface CaptureResult {
  sessionId: string;
  baseUrl: string;
  capturedPages: CapturedPage[];
  flowSteps: FlowStep[];
  zipBuffer: Buffer;
  totalPages: number;
  successCount: number;
  failureCount: number;
  maxDepthReached: number;
}

export interface CapturedPage {
  url: string;
  filename: string;
  success: boolean;
  error?: string;
  screenshot?: Buffer;
  stepNumber: number;
  flowPath: string[];
  capturedAt: Date;
  pageTitle?: string;
  elementClicked?: ClickableElement;
}

export interface FlowStep {
  stepNumber: number;
  fromUrl: string;
  toUrl: string;
  action: 'initial_load' | 'click_link' | 'click_button' | 'click_element';
  elementClicked?: ClickableElement;
  success: boolean;
  error?: string;
  screenshotTaken: boolean;
  timestamp: Date;
}

export interface ClickableElement {
  tagName: string;
  selector: string;
  text?: string;
  href?: string;
  onclick?: boolean;
  type: 'link' | 'button' | 'clickable_div' | 'interactive_element';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FlowCaptureOptions {
  maxDepth: number;
  maxElements: number;
  waitAfterClick: number;
  includeExternalLinks: boolean;
  excludeSelectors: string[];
  onlyInternalNavigation: boolean;
}

export class ScreenshotCapture {
  private browser: Browser | null = null;
  private readonly timeout = 30000; // 30초
  private readonly visitedUrls = new Set<string>();
  private readonly visitedElements = new Set<string>();
  private capturedPages: CapturedPage[] = [];
  private flowSteps: FlowStep[] = [];
  private currentDepth = 0;
  private stepCounter = 0;
  
  // 기본 플로우 캡처 옵션
  private readonly defaultOptions: FlowCaptureOptions = {
    maxDepth: 2,
    maxElements: 15,
    waitAfterClick: 3000,
    includeExternalLinks: false,
    excludeSelectors: [
      '[href*="mailto:"]',
      '[href*="tel:"]', 
      '[href*="javascript:"]',
      '.cookie-banner',
      '.popup',
      '.modal',
      '[data-dismiss]',
      '.close-button'
    ],
    onlyInternalNavigation: true
  };

  async initialize(): Promise<void> {
    console.log(`[ScreenshotCapture] 브라우저 초기화 시작`);
    
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
        // headless: "new", // 최신 headless 모드 사용 (필요시)
        defaultViewport: null,
        // ignoreHTTPSErrors: true
      });
      
      console.log(`[ScreenshotCapture] 브라우저 초기화 완료`);
      
    } catch (error) {
      console.error(`[ScreenshotCapture] 브라우저 초기화 실패:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureWebsiteFlow(baseUrl: string, sessionId: string, options?: Partial<FlowCaptureOptions>): Promise<CaptureResult> {
    await this.initialize();
    if (!this.browser) throw new Error('Browser not initialized.');

    // 상태 초기화
    this.visitedUrls.clear();
    this.visitedElements.clear();
    this.capturedPages = [];
    this.flowSteps = [];
    this.currentDepth = 0;
    this.stepCounter = 0;

    const finalOptions = { ...this.defaultOptions, ...options };
    
    console.log(`[FlowCapture] 플로우 캡처 시작: ${baseUrl}`);
    console.log(`[FlowCapture] 옵션:`, finalOptions);

    try {
      // 1단계: 초기 페이지 로드 및 캡처
      await this.captureInitialPage(baseUrl, sessionId);
      
      // 2단계: 플로우 탐색 및 캡처
      await this.exploreAndCaptureFlow(baseUrl, finalOptions);

      // 3단계: ZIP 파일 생성
      const zipBuffer = await this.createFlowZipFile(sessionId);
      
      const successCount = this.capturedPages.filter(p => p.success).length;
      const failureCount = this.capturedPages.length - successCount;

      console.log(`[FlowCapture] 완료: ${successCount}/${this.capturedPages.length} 성공, 최대 깊이: ${Math.max(...this.flowSteps.map(s => s.stepNumber))}`);

      return {
        sessionId,
        baseUrl,
        capturedPages: this.capturedPages,
        flowSteps: this.flowSteps,
        zipBuffer,
        totalPages: this.capturedPages.length,
        successCount,
        failureCount,
        maxDepthReached: this.currentDepth
      };

    } catch (error) {
      console.error('[FlowCapture] 프로세스 오류:', error);
      throw error;
    }
  }

  private async capturePage(url: string, pageNumber: number): Promise<CapturedPage> {
    const filename = `${pageNumber.toString().padStart(2, '0')}_${this.sanitizeFilename(url)}.png`;
    
    console.log(`[ScreenshotCapture] 캡처 시작: ${url} -> ${filename}`);
    
    let page: any = null;
    
    try {
      page = await this.browser!.newPage();
      console.log(`[ScreenshotCapture] 새 페이지 생성 완료: ${url}`);
      
      // 뷰포트 설정
      await page.setViewport({ width: 1920, height: 1080 });
      console.log(`[ScreenshotCapture] 뷰포트 설정 완료: ${url}`);
      
      // 페이지 로드
      console.log(`[ScreenshotCapture] 페이지 로딩 시작: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: this.timeout 
      });
      console.log(`[ScreenshotCapture] 페이지 로딩 완료: ${url}`);
      
      // 추가 로딩 대기 (동적 콘텐츠) - waitForTimeout 대신 setTimeout 사용
      console.log(`[ScreenshotCapture] 추가 로딩 대기 시작: ${url}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[ScreenshotCapture] 추가 로딩 대기 완료: ${url}`);
      
      // 전체 페이지 스크린샷
      console.log(`[ScreenshotCapture] 스크린샷 캡처 시작: ${url}`);
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      const screenshotBuffer = screenshot as Buffer;
      console.log(`[ScreenshotCapture] 스크린샷 캡처 완료: ${url}, 크기: ${screenshotBuffer.length} bytes`);
      
      if (screenshotBuffer.length === 0) {
        throw new Error('스크린샷 데이터가 비어있습니다');
      }
      
      await page.close();
      console.log(`[ScreenshotCapture] 페이지 종료 완료: ${url}`);
      
      return {
        url,
        filename,
        success: true,
        screenshot: screenshotBuffer
      };
      
    } catch (error) {
      console.error(`[ScreenshotCapture] 페이지 캡처 실패 ${url}:`, error);
      
      // 페이지가 열려있으면 닫기
      if (page) {
        try {
          await page.close();
          console.log(`[ScreenshotCapture] 실패 후 페이지 정리 완료: ${url}`);
        } catch (closeError) {
          console.error(`[ScreenshotCapture] 페이지 정리 실패: ${url}:`, closeError);
        }
      }
      
      return {
        url,
        filename,
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }

  private async extractInternalLinks(currentUrl: string, baseUrl: string): Promise<string[]> {
    try {
      const page = await this.browser!.newPage();
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: this.timeout });
      
      const links = await page.evaluate((baseUrlParam) => {
        const anchorElements = Array.from(document.querySelectorAll('a[href]'));
        const baseUrlObj = new URL(baseUrlParam);
        
        return anchorElements
          .map(a => {
            try {
              const href = (a as HTMLAnchorElement).href;
              const linkUrl = new URL(href);
              
              // 같은 도메인의 링크만 반환
              if (linkUrl.hostname === baseUrlObj.hostname) {
                return linkUrl.href;
              }
              return null;
            } catch {
              return null;
            }
          })
          .filter((link): link is string => link !== null)
          .filter((link, index, arr) => arr.indexOf(link) === index); // 중복 제거
      }, baseUrl);
      
      await page.close();
      return links;
      
    } catch (error) {
      console.error(`링크 추출 실패 ${currentUrl}:`, error);
      return [];
    }
  }

  private async createZipFile(capturedPages: CapturedPage[], sessionId: string): Promise<Buffer> {
    console.log(`[ScreenshotCapture] ZIP 파일 생성 시작: ${sessionId}`);
    console.log(`[ScreenshotCapture] 캡처된 페이지 수: ${capturedPages.length}`);
    
    const zip = new JSZip();
    
    const successfulPages = capturedPages.filter(p => p.success);
    const failedPages = capturedPages.filter(p => !p.success);
    
    console.log(`[ScreenshotCapture] 성공한 페이지: ${successfulPages.length}개`);
    console.log(`[ScreenshotCapture] 실패한 페이지: ${failedPages.length}개`);
    
    // 메타데이터 추가
    const metadata = {
      sessionId,
      capturedAt: new Date().toISOString(),
      totalPages: capturedPages.length,
      successCount: successfulPages.length,
      failureCount: failedPages.length,
      pages: capturedPages.map(page => ({
        url: page.url,
        filename: page.filename,
        success: page.success,
        error: page.error,
        screenshotSize: page.screenshot ? page.screenshot.length : 0
      }))
    };
    
    console.log(`[ScreenshotCapture] 메타데이터 생성 완료`);
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // 성공한 스크린샷들 추가
    let addedImageCount = 0;
    successfulPages.forEach(page => {
      if (page.screenshot && page.screenshot.length > 0) {
        console.log(`[ScreenshotCapture] 이미지 추가: ${page.filename} (${page.screenshot.length} bytes)`);
        zip.file(page.filename, page.screenshot);
        addedImageCount++;
      } else {
        console.warn(`[ScreenshotCapture] 스크린샷 데이터가 없음: ${page.filename}`);
      }
    });
    
    console.log(`[ScreenshotCapture] 총 ${addedImageCount}개 이미지 파일 추가됨`);
    
    // 실패 로그 추가
    if (failedPages.length > 0) {
      const failureLog = failedPages.map(f => 
        `URL: ${f.url}\nError: ${f.error}\n---`
      ).join('\n');
      zip.file('failures.txt', failureLog);
      console.log(`[ScreenshotCapture] 실패 로그 추가: ${failedPages.length}개 실패`);
    }
    
    console.log(`[ScreenshotCapture] ZIP 파일 생성 중...`);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[ScreenshotCapture] ZIP 파일 생성 완료: ${zipBuffer.length} bytes`);
    
    return zipBuffer;
  }

  private sanitizeFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      let name = urlObj.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      
      if (!name || name === '_') {
        name = 'homepage';
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

  // ===== 새로운 플로우 캡처 메소드들 =====

  private async captureInitialPage(baseUrl: string, sessionId: string): Promise<void> {
    console.log(`[FlowCapture] 1단계: 초기 페이지 로드 및 캡처 - ${baseUrl}`);
    
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    // FlowStep 기록
    const flowStep: FlowStep = {
      stepNumber,
      fromUrl: '',
      toUrl: baseUrl,
      action: 'initial_load',
      success: false,
      screenshotTaken: false,
      timestamp: new Date()
    };

    try {
      const page = await this.browser!.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log(`[FlowCapture] 페이지 로딩: ${baseUrl}`);
      await page.goto(baseUrl, { 
        waitUntil: 'networkidle2', 
        timeout: this.timeout 
      });
      
      // 추가 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 페이지 제목 추출
      const pageTitle = await page.title().catch(() => 'Unknown Title');
      
      // 스크린샷 캡처
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      const screenshotBuffer = screenshot as Buffer;
      console.log(`[FlowCapture] 초기 페이지 캡처 완료: ${screenshotBuffer.length} bytes`);
      
      // CapturedPage 기록
      const capturedPage: CapturedPage = {
        url: baseUrl,
        filename: `${stepNumber.toString().padStart(2, '0')}_초기페이지_${this.sanitizeFilename(baseUrl)}.png`,
        success: true,
        screenshot: screenshotBuffer,
        stepNumber,
        flowPath: [baseUrl],
        capturedAt: new Date(),
        pageTitle
      };
      
      this.capturedPages.push(capturedPage);
      this.visitedUrls.add(baseUrl);
      
      flowStep.success = true;
      flowStep.screenshotTaken = true;
      
      await page.close();
      
    } catch (error) {
      console.error(`[FlowCapture] 초기 페이지 캡처 실패:`, error);
      flowStep.error = error instanceof Error ? error.message : '알 수 없는 오류';
      
      // 실패한 경우에도 기록
      const capturedPage: CapturedPage = {
        url: baseUrl,
        filename: `${stepNumber.toString().padStart(2, '0')}_초기페이지_실패.png`,
        success: false,
        error: flowStep.error,
        stepNumber,
        flowPath: [baseUrl],
        capturedAt: new Date()
      };
      
      this.capturedPages.push(capturedPage);
    }
    
    this.flowSteps.push(flowStep);
  }

  private async exploreAndCaptureFlow(baseUrl: string, options: FlowCaptureOptions): Promise<void> {
    console.log(`[FlowCapture] 2단계: 플로우 탐색 및 캡처 시작`);
    
    const baseUrlObj = new URL(baseUrl);
    const queue: { url: string; depth: number; fromUrl: string; flowPath: string[] }[] = [
      { url: baseUrl, depth: 0, fromUrl: '', flowPath: [baseUrl] }
    ];
    
    while (queue.length > 0 && this.capturedPages.length < options.maxElements) {
      const { url: currentUrl, depth, fromUrl, flowPath } = queue.shift()!;
      
      if (depth > options.maxDepth) {
        console.log(`[FlowCapture] 최대 깊이 도달: ${depth}`);
        continue;
      }
      
      this.currentDepth = Math.max(this.currentDepth, depth);
      
      console.log(`[FlowCapture] 탐색 중: ${currentUrl} (깊이: ${depth})`);
      
      try {
        const clickableElements = await this.findClickableElements(currentUrl, baseUrlObj, options);
        console.log(`[FlowCapture] 발견된 클릭 가능한 요소: ${clickableElements.length}개`);
        
        for (const element of clickableElements) {
          if (this.capturedPages.length >= options.maxElements) {
            console.log(`[FlowCapture] 최대 요소 수 도달: ${options.maxElements}`);
            break;
          }
          
          const elementId = this.generateElementId(element);
          if (this.visitedElements.has(elementId)) {
            continue;
          }
          
          this.visitedElements.add(elementId);
          
          const result = await this.clickAndCapture(currentUrl, element, depth + 1, flowPath, options);
          
          if (result.success && result.newUrl && !this.visitedUrls.has(result.newUrl)) {
            this.visitedUrls.add(result.newUrl);
            
            // 새로운 URL을 큐에 추가 (내부 링크인 경우)
            if (this.isInternalUrl(result.newUrl, baseUrlObj)) {
              queue.push({
                url: result.newUrl,
                depth: depth + 1,
                fromUrl: currentUrl,
                flowPath: [...flowPath, result.newUrl]
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`[FlowCapture] ${currentUrl} 탐색 중 오류:`, error);
      }
    }
  }

  private async findClickableElements(url: string, baseUrlObj: URL, options: FlowCaptureOptions): Promise<ClickableElement[]> {
    console.log(`[FlowCapture] 클릭 가능한 요소 탐색: ${url}`);
    
    const page = await this.browser!.newPage();
    const clickableElements: ClickableElement[] = [];
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: this.timeout });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 클릭 가능한 요소들을 찾는 스크립트 실행
      const elements = await page.evaluate((excludeSelectors: string[], onlyInternal: boolean, baseHost: string) => {
        const clickableElements: any[] = [];
        
        // 선택자 생성 함수 (브라우저 context에서 실행)
        function generateSelector(element: Element): string {
          if (element.id) {
            return `#${element.id}`;
          }
          
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
              return `.${classes[0]}`;
            }
          }
          
          const tagName = element.tagName.toLowerCase();
          const parent = element.parentElement;
          
          if (!parent) {
            return tagName;
          }
          
          const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
          if (siblings.length === 1) {
            return `${generateSelector(parent)} > ${tagName}`;
          }
          
          const index = siblings.indexOf(element) + 1;
          return `${generateSelector(parent)} > ${tagName}:nth-child(${index})`;
        }
        
        // 링크 요소들
        const links = document.querySelectorAll('a[href]');
        links.forEach((link: Element) => {
          const anchor = link as HTMLAnchorElement;
          const href = anchor.href;
          const text = anchor.textContent?.trim() || '';
          
          // 제외할 선택자 확인
          const shouldExclude = excludeSelectors.some(selector => {
            try {
              return anchor.matches(selector);
            } catch {
              return false;
            }
          });
          
          if (shouldExclude) return;
          
          // 내부 링크만 허용하는 경우
          if (onlyInternal) {
            try {
              const linkUrl = new URL(href);
              if (linkUrl.hostname !== baseHost) return;
            } catch {
              return;
            }
          }
          
          const rect = anchor.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            clickableElements.push({
              tagName: 'A',
              selector: generateSelector(anchor),
              text: text.substring(0, 100),
              href,
              type: 'link',
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            });
          }
        });
        
        // 버튼 요소들
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        buttons.forEach((button: Element) => {
          const buttonEl = button as HTMLButtonElement;
          const text = buttonEl.textContent?.trim() || buttonEl.getAttribute('value') || '';
          
          const shouldExclude = excludeSelectors.some(selector => {
            try {
              return buttonEl.matches(selector);
            } catch {
              return false;
            }
          });
          
          if (shouldExclude) return;
          
          const rect = buttonEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            clickableElements.push({
              tagName: buttonEl.tagName,
              selector: generateSelector(buttonEl),
              text: text.substring(0, 100),
              type: 'button',
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            });
          }
        });
        
        // 클릭 핸들러가 있는 요소들
        const clickableOthers = document.querySelectorAll('[onclick], [data-href], [role="button"]');
        clickableOthers.forEach((element: Element) => {
          const el = element as HTMLElement;
          const text = el.textContent?.trim() || '';
          
          const shouldExclude = excludeSelectors.some(selector => {
            try {
              return el.matches(selector);
            } catch {
              return false;
            }
          });
          
          if (shouldExclude) return;
          
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            clickableElements.push({
              tagName: el.tagName,
              selector: generateSelector(el),
              text: text.substring(0, 100),
              onclick: true,
              type: 'interactive_element',
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            });
          }
        });
        
        return clickableElements;
      }, options.excludeSelectors, options.onlyInternalNavigation, baseUrlObj.hostname);
      
      // 중복 제거 및 우선순위 정렬
      const uniqueElements = this.deduplicateElements(elements);
      const prioritizedElements = this.prioritizeElements(uniqueElements);
      
      console.log(`[FlowCapture] 총 ${prioritizedElements.length}개 클릭 가능한 요소 발견`);
      
      return prioritizedElements;
      
    } catch (error) {
      console.error(`[FlowCapture] 요소 탐색 중 오류:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  private async clickAndCapture(
    currentUrl: string, 
    element: ClickableElement, 
    depth: number, 
    flowPath: string[], 
    options: FlowCaptureOptions
  ): Promise<{ success: boolean; newUrl?: string; screenshotTaken: boolean }> {
    console.log(`[FlowCapture] 요소 클릭 시도: ${element.type} - "${element.text?.substring(0, 50)}"`);
    
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    const flowStep: FlowStep = {
      stepNumber,
      fromUrl: currentUrl,
      toUrl: currentUrl,
      action: element.type === 'link' ? 'click_link' : 
              element.type === 'button' ? 'click_button' : 'click_element',
      elementClicked: element,
      success: false,
      screenshotTaken: false,
      timestamp: new Date()
    };
    
    const page = await this.browser!.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: this.timeout });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 현재 URL 저장
      const beforeUrl = page.url();
      
      // 요소 클릭
      await page.click(element.selector);
      console.log(`[FlowCapture] 요소 클릭됨: ${element.selector}`);
      
      // 클릭 후 변화 대기
      await new Promise(resolve => setTimeout(resolve, options.waitAfterClick));
      
      // 페이지 변화 확인
      const afterUrl = page.url();
      const urlChanged = beforeUrl !== afterUrl;
      
      flowStep.toUrl = afterUrl;
      
      if (urlChanged) {
        console.log(`[FlowCapture] URL 변경 감지: ${beforeUrl} -> ${afterUrl}`);
      }
      
      // 페이지 제목 추출
      const pageTitle = await page.title().catch(() => 'Unknown Title');
      
      // 스크린샷 캡처
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      const screenshotBuffer = screenshot as Buffer;
      console.log(`[FlowCapture] 클릭 후 스크린샷 캡처: ${screenshotBuffer.length} bytes`);
      
      // 파일명 생성
      const actionName = element.type === 'link' ? '링크클릭' :
                        element.type === 'button' ? '버튼클릭' : '요소클릭';
      const elementText = this.sanitizeFilename(element.text || 'unknown');
      const filename = `${stepNumber.toString().padStart(2, '0')}_${actionName}_${elementText}.png`;
      
      // CapturedPage 기록
      const capturedPage: CapturedPage = {
        url: afterUrl,
        filename,
        success: true,
        screenshot: screenshotBuffer,
        stepNumber,
        flowPath: urlChanged ? [...flowPath, afterUrl] : flowPath,
        capturedAt: new Date(),
        pageTitle,
        elementClicked: element
      };
      
      this.capturedPages.push(capturedPage);
      
      flowStep.success = true;
      flowStep.screenshotTaken = true;
      
      return {
        success: true,
        newUrl: urlChanged ? afterUrl : undefined,
        screenshotTaken: true
      };
      
    } catch (error) {
      console.error(`[FlowCapture] 클릭 및 캡처 실패:`, error);
      
      flowStep.error = error instanceof Error ? error.message : '알 수 없는 오류';
      
      // 실패한 경우에도 기록
      const capturedPage: CapturedPage = {
        url: currentUrl,
        filename: `${stepNumber.toString().padStart(2, '0')}_클릭실패_${this.sanitizeFilename(element.text || 'unknown')}.png`,
        success: false,
        error: flowStep.error,
        stepNumber,
        flowPath,
        capturedAt: new Date(),
        elementClicked: element
      };
      
      this.capturedPages.push(capturedPage);
      
      return {
        success: false,
        screenshotTaken: false
      };
      
    } finally {
      this.flowSteps.push(flowStep);
      await page.close();
    }
  }

  private generateElementId(element: ClickableElement): string {
    return `${element.tagName}:${element.selector}:${element.text || ''}`;
  }

  private isInternalUrl(url: string, baseUrlObj: URL): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  }

  private deduplicateElements(elements: any[]): ClickableElement[] {
    const seen = new Set<string>();
    return elements.filter(element => {
      const key = `${element.selector}:${element.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private prioritizeElements(elements: ClickableElement[]): ClickableElement[] {
    return elements.sort((a, b) => {
      // 링크 우선
      if (a.type === 'link' && b.type !== 'link') return -1;
      if (a.type !== 'link' && b.type === 'link') return 1;
      
      // 버튼 다음 우선
      if (a.type === 'button' && b.type === 'interactive_element') return -1;
      if (a.type === 'interactive_element' && b.type === 'button') return 1;
      
      // 텍스트가 있는 것 우선
      if (a.text && !b.text) return -1;
      if (!a.text && b.text) return 1;
      
      return 0;
    });
  }

  private async createFlowZipFile(sessionId: string): Promise<Buffer> {
    console.log(`[FlowCapture] ZIP 파일 생성 시작: ${sessionId}`);
    
    const zip = new JSZip();
    
    const successfulPages = this.capturedPages.filter(p => p.success);
    const failedPages = this.capturedPages.filter(p => !p.success);
    
    console.log(`[FlowCapture] 성공한 페이지: ${successfulPages.length}개`);
    console.log(`[FlowCapture] 실패한 페이지: ${failedPages.length}개`);
    
    // 성공한 스크린샷들 추가
    let addedImageCount = 0;
    successfulPages.forEach(page => {
      if (page.screenshot && page.screenshot.length > 0) {
        console.log(`[FlowCapture] 이미지 추가: ${page.filename} (${page.screenshot.length} bytes)`);
        zip.file(page.filename, page.screenshot);
        addedImageCount++;
      }
    });
    
    console.log(`[FlowCapture] 총 ${addedImageCount}개 이미지 파일 추가됨`);
    
    // 강화된 메타데이터
    const metadata = {
      sessionId,
      capturedAt: new Date().toISOString(),
      captureType: 'flow_capture',
      totalPages: this.capturedPages.length,
      successCount: successfulPages.length,
      failureCount: failedPages.length,
      maxDepthReached: this.currentDepth,
      totalSteps: this.flowSteps.length,
      pages: this.capturedPages.map(page => ({
        stepNumber: page.stepNumber,
        url: page.url,
        filename: page.filename,
        success: page.success,
        error: page.error,
        flowPath: page.flowPath,
        pageTitle: page.pageTitle,
        capturedAt: page.capturedAt.toISOString(),
        screenshotSize: page.screenshot ? page.screenshot.length : 0,
        elementClicked: page.elementClicked ? {
          type: page.elementClicked.type,
          text: page.elementClicked.text,
          tagName: page.elementClicked.tagName
        } : undefined
      })),
      flowSteps: this.flowSteps.map(step => ({
        stepNumber: step.stepNumber,
        fromUrl: step.fromUrl,
        toUrl: step.toUrl,
        action: step.action,
        success: step.success,
        error: step.error,
        screenshotTaken: step.screenshotTaken,
        timestamp: step.timestamp.toISOString(),
        elementClicked: step.elementClicked ? {
          type: step.elementClicked.type,
          text: step.elementClicked.text,
          tagName: step.elementClicked.tagName
        } : undefined
      }))
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // 플로우 요약 파일
    const flowSummary = this.generateFlowSummary();
    zip.file('flow_summary.txt', flowSummary);
    
    // 실패 로그 추가
    if (failedPages.length > 0) {
      const failureLog = failedPages.map(f => 
        `Step ${f.stepNumber}: ${f.url}\nError: ${f.error}\nElement: ${f.elementClicked?.text || 'N/A'}\n---`
      ).join('\n');
      zip.file('failures.txt', failureLog);
      console.log(`[FlowCapture] 실패 로그 추가: ${failedPages.length}개 실패`);
    }
    
    console.log(`[FlowCapture] ZIP 파일 생성 중...`);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[FlowCapture] ZIP 파일 생성 완료: ${zipBuffer.length} bytes`);
    
    return zipBuffer;
  }

  private generateFlowSummary(): string {
    const summary: string[] = [];
    summary.push('=== 웹사이트 플로우 캡처 요약 ===\n');
    summary.push(`캡처 일시: ${new Date().toLocaleString('ko-KR')}`);
    summary.push(`총 단계: ${this.flowSteps.length}`);
    summary.push(`성공한 캡처: ${this.capturedPages.filter(p => p.success).length}`);
    summary.push(`실패한 캡처: ${this.capturedPages.filter(p => !p.success).length}`);
    summary.push(`최대 탐색 깊이: ${this.currentDepth}`);
    summary.push('');
    
    summary.push('=== 플로우 단계별 상세 ===');
    this.flowSteps.forEach((step, index) => {
      summary.push(`${index + 1}. [${step.action}] ${step.fromUrl} -> ${step.toUrl}`);
      if (step.elementClicked) {
        summary.push(`   요소: ${step.elementClicked.type} - "${step.elementClicked.text}"`);
      }
      summary.push(`   결과: ${step.success ? '성공' : '실패'}`);
      if (step.error) {
        summary.push(`   오류: ${step.error}`);
      }
      summary.push('');
    });
    
    return summary.join('\n');
  }
}
