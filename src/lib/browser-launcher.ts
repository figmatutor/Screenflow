import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Vercel과 로컬 환경 모두에서 작동하는 브라우저 런처
 */
export class BrowserLauncher {
  static async launch(viewportWidth?: number, viewportHeight?: number): Promise<Browser> {
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
          defaultViewport: { 
            width: viewportWidth || 1440, 
            height: viewportHeight || 900 
          },
          executablePath,
          headless: true,
          timeout: 30000 // 30초 타임아웃
        });
        
        console.log(`[BrowserLauncher] Serverless 브라우저 초기화 성공`);
        return browser;
      } else {
        // 로컬 환경에서는 시스템 Chrome 사용
        console.log(`[BrowserLauncher] 로컬 환경 감지 - 시스템 Chrome 사용`);
        
        // 로컬 환경에서 Chrome 경로 자동 감지
        let executablePath = process.env.CHROME_EXECUTABLE_PATH;
        
        if (!executablePath) {
          // 운영체제별 Chrome 경로 감지
          const os = require('os');
          const fs = require('fs');
          
          const chromePaths = {
            darwin: [
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              '/Applications/Chromium.app/Contents/MacOS/Chromium'
            ],
            linux: [
              '/usr/bin/google-chrome-stable',
              '/usr/bin/google-chrome',
              '/usr/bin/chromium-browser',
              '/usr/bin/chromium'
            ],
            win32: [
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
              'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ]
          };
          
          const platform = os.platform();
          const paths = chromePaths[platform] || [];
          
          for (const path of paths) {
            if (fs.existsSync(path)) {
              executablePath = path;
              break;
            }
          }
        }
        
        console.log(`[BrowserLauncher] Chrome 경로: ${executablePath}`);
        
        return await puppeteer.launch({
          headless: true,
          executablePath,
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
            '--disable-renderer-backgrounding',
            // 네트워크 연결 개선
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-features=NetworkService,NetworkServiceLogging',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--disable-plugins',
            '--force-color-profile=srgb',
            '--metrics-recording-only',
            '--use-mock-keychain',
            // DNS 및 네트워크 설정 (macOS 최적화)
            '--disable-ipc-flooding-protection',
            '--disable-field-trial-config',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-bundled-ppapi-flash',
            '--disable-plugins-discovery',
            '--disable-component-extensions-with-background-pages',
            // macOS 특화 설정
            '--use-system-default-printer',
            '--disable-print-preview',
            '--no-pings',
            '--no-referrers'
          ],
          defaultViewport: { 
            width: viewportWidth || 1440, 
            height: viewportHeight || 900 
          },
          timeout: 30000, // 30초 타임아웃
          // 네트워크 연결 재시도 설정
          ignoreDefaultArgs: ['--disable-extensions'],
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        });
      }
    } catch (error) {
      console.error(`[BrowserLauncher] 브라우저 초기화 실패:`, error);
      throw new Error(`브라우저 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// 기존 함수도 유지 (하위 호환성)
export async function launchBrowser(viewportWidth?: number, viewportHeight?: number): Promise<Browser> {
  return BrowserLauncher.launch(viewportWidth, viewportHeight);
}
