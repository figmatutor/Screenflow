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
      const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
      
      if (isVercel) {
        // Vercel 환경에서는 @sparticuz/chromium 사용
        console.log(`[BrowserLauncher] Serverless 환경 감지 - @sparticuz/chromium 사용`);
        
        return await puppeteer.launch({
          args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
          defaultViewport: { width: 1280, height: 720 },
          executablePath: await chromium.executablePath(),
          headless: true,
        });
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
