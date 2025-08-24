import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Vercel과 로컬 환경 모두에서 작동하는 브라우저 런처
 */
export class BrowserLauncher {
  static async launch(): Promise<Browser> {
    console.log(`[BrowserLauncher] 브라우저 초기화 시작`);
    
    try {
      // Vercel/serverless 환경 감지
      const isVercel = process.env.VERCEL === '1' || 
                      process.env.AWS_LAMBDA_FUNCTION_NAME ||
                      process.env.NODE_ENV === 'production';
      
      console.log(`[BrowserLauncher] 환경 변수 체크:`, {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        AWS_LAMBDA: process.env.AWS_LAMBDA_FUNCTION_NAME,
        isVercel
      });
      
      if (isVercel) {
        // Vercel 환경에서는 @sparticuz/chromium 사용
        console.log(`[BrowserLauncher] Serverless 환경 감지 - @sparticuz/chromium 사용`);
        
        // chromium 실행 파일 경로 확보
        const executablePath = await chromium.executablePath();
        console.log(`[BrowserLauncher] Executable path: ${executablePath}`);
        
        const browser = await puppeteer.launch({
          args: [
            ...chromium.args,
            '--hide-scrollbars',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--memory-pressure-off',
            '--max_old_space_size=512',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--single-process', // Vercel에서 안정성 향상
            '--disable-features=VizDisplayCompositor'
          ],
          defaultViewport: { width: 800, height: 600 },
          executablePath,
          headless: true,
          timeout: 30000 // 30초 타임아웃
        });
        
        console.log(`[BrowserLauncher] Serverless 브라우저 초기화 성공`);
        return browser;
      } else {
        // 로컬 환경에서는 시스템 Chrome 사용
        console.log(`[BrowserLauncher] 로컬 환경 감지 - 시스템 Chrome 사용`);
        
        return await puppeteer.launch({
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
          // 로컬에서 시스템에 설치된 Chrome 사용
          executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined
        });
      }
    } catch (error) {
      console.error(`[BrowserLauncher] 브라우저 초기화 실패:`, error);
      throw new Error(`브라우저 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
