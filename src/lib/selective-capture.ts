import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './browser-launcher';
import JSZip from 'jszip';
import { DiscoveredLink } from './link-discovery';

export interface CaptureRequest {
  sessionId: string;
  baseUrl: string;
  selectedUrls: string[];
}

export interface CapturedScreenshot {
  url: string;
  filename: string;
  success: boolean;
  error?: string;
  screenshot?: Buffer;
  pageTitle?: string;
  capturedAt: Date;
  order: number;
}

export interface SelectiveCaptureResult {
  sessionId: string;
  baseUrl: string;
  capturedScreenshots: CapturedScreenshot[];
  zipBuffer: Buffer;
  totalRequested: number;
  successCount: number;
  failureCount: number;
}

export class SelectiveCapture {
  private browser: Browser | null = null;
  private readonly timeout = 30000; // 30초

  async initialize(): Promise<void> {
    console.log(`[SelectiveCapture] 브라우저 초기화 시작`);
    
    try {
      this.browser = await launchBrowser();
      console.log(`[SelectiveCapture] 브라우저 초기화 완료`);
    } catch (error) {
      console.error(`[SelectiveCapture] 브라우저 초기화 실패:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureSelected(request: CaptureRequest, progressCallback?: (progress: { current: number; total: number; url: string }) => void): Promise<SelectiveCaptureResult> {
    await this.initialize();
    if (!this.browser) throw new Error('Browser not initialized.');

    console.log(`[SelectiveCapture] 선택적 캡처 시작: ${request.selectedUrls.length}개 URL`);

    const capturedScreenshots: CapturedScreenshot[] = [];
    
    for (let i = 0; i < request.selectedUrls.length; i++) {
      const url = request.selectedUrls[i];
      const order = i + 1;
      
      console.log(`[SelectiveCapture] 캡처 중 (${order}/${request.selectedUrls.length}): ${url}`);
      
      // 진행 상황 콜백 호출
      if (progressCallback) {
        progressCallback({
          current: order,
          total: request.selectedUrls.length,
          url
        });
      }
      
      const result = await this.captureUrl(url, order);
      capturedScreenshots.push(result);
    }

    // ZIP 파일 생성
    const zipBuffer = await this.createZipFile(capturedScreenshots, request.sessionId, request.baseUrl);
    
    const successCount = capturedScreenshots.filter(s => s.success).length;
    const failureCount = capturedScreenshots.length - successCount;

    console.log(`[SelectiveCapture] 캡처 완료: ${successCount}/${capturedScreenshots.length} 성공`);

    return {
      sessionId: request.sessionId,
      baseUrl: request.baseUrl,
      capturedScreenshots,
      zipBuffer,
      totalRequested: request.selectedUrls.length,
      successCount,
      failureCount
    };
  }

  private async captureUrl(url: string, order: number): Promise<CapturedScreenshot> {
    const filename = `${order.toString().padStart(2, '0')}_${this.sanitizeFilename(url)}.png`;
    
    console.log(`[SelectiveCapture] 캡처 시작: ${url} -> ${filename}`);
    
    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      // 페이지 로드
      await page.goto(url, { 
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
      console.log(`[SelectiveCapture] 캡처 완료: ${url} (${screenshotBuffer.length} bytes)`);
      
      return {
        url,
        filename,
        success: true,
        screenshot: screenshotBuffer,
        pageTitle,
        capturedAt: new Date(),
        order
      };
      
    } catch (error) {
      console.error(`[SelectiveCapture] 캡처 실패: ${url}`, error);
      
      return {
        url,
        filename,
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        capturedAt: new Date(),
        order
      };
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async createZipFile(screenshots: CapturedScreenshot[], sessionId: string, baseUrl: string): Promise<Buffer> {
    console.log(`[SelectiveCapture] ZIP 파일 생성 시작: ${sessionId}`);
    
    const zip = new JSZip();
    
    const successfulScreenshots = screenshots.filter(s => s.success);
    const failedScreenshots = screenshots.filter(s => !s.success);
    
    console.log(`[SelectiveCapture] 성공한 스크린샷: ${successfulScreenshots.length}개`);
    console.log(`[SelectiveCapture] 실패한 스크린샷: ${failedScreenshots.length}개`);
    
    // 성공한 스크린샷들 추가
    let addedImageCount = 0;
    successfulScreenshots.forEach(screenshot => {
      if (screenshot.screenshot && screenshot.screenshot.length > 0) {
        console.log(`[SelectiveCapture] 이미지 추가: ${screenshot.filename} (${screenshot.screenshot.length} bytes)`);
        zip.file(screenshot.filename, screenshot.screenshot);
        addedImageCount++;
      }
    });
    
    console.log(`[SelectiveCapture] 총 ${addedImageCount}개 이미지 파일 추가됨`);
    
    // 메타데이터
    const metadata = {
      sessionId,
      capturedAt: new Date().toISOString(),
      captureType: 'selective_capture',
      baseUrl,
      totalRequested: screenshots.length,
      successCount: successfulScreenshots.length,
      failureCount: failedScreenshots.length,
      screenshots: screenshots.map(screenshot => ({
        order: screenshot.order,
        url: screenshot.url,
        filename: screenshot.filename,
        success: screenshot.success,
        error: screenshot.error,
        pageTitle: screenshot.pageTitle,
        capturedAt: screenshot.capturedAt.toISOString(),
        screenshotSize: screenshot.screenshot ? screenshot.screenshot.length : 0
      }))
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // 캡처 요약 파일
    const summary = this.generateCaptureSummary(screenshots, baseUrl);
    zip.file('capture_summary.txt', summary);
    
    // 실패 로그 추가
    if (failedScreenshots.length > 0) {
      const failureLog = failedScreenshots.map(f => 
        `${f.order}. ${f.url}\nError: ${f.error}\nTime: ${f.capturedAt.toISOString()}\n---`
      ).join('\n');
      zip.file('failures.txt', failureLog);
      console.log(`[SelectiveCapture] 실패 로그 추가: ${failedScreenshots.length}개 실패`);
    }
    
    console.log(`[SelectiveCapture] ZIP 파일 생성 중...`);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[SelectiveCapture] ZIP 파일 생성 완료: ${zipBuffer.length} bytes`);
    
    return zipBuffer;
  }

  private generateCaptureSummary(screenshots: CapturedScreenshot[], baseUrl: string): string {
    const summary: string[] = [];
    summary.push('=== 선택적 스크린샷 캡처 요약 ===\n');
    summary.push(`기본 URL: ${baseUrl}`);
    summary.push(`캡처 일시: ${new Date().toLocaleString('ko-KR')}`);
    summary.push(`총 요청: ${screenshots.length}`);
    summary.push(`성공한 캡처: ${screenshots.filter(s => s.success).length}`);
    summary.push(`실패한 캡처: ${screenshots.filter(s => !s.success).length}`);
    summary.push('');
    
    summary.push('=== 캡처 상세 목록 ===');
    screenshots.forEach((screenshot, index) => {
      summary.push(`${screenshot.order}. ${screenshot.success ? '✅' : '❌'} ${screenshot.url}`);
      if (screenshot.pageTitle) {
        summary.push(`   제목: ${screenshot.pageTitle}`);
      }
      if (screenshot.error) {
        summary.push(`   오류: ${screenshot.error}`);
      }
      summary.push('');
    });
    
    return summary.join('\n');
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
