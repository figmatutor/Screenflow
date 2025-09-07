const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { chromium, firefox, webkit } = require('playwright');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🛡️ 보안 및 미들웨어 설정
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 🚦 Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// 🔐 API 키 인증 미들웨어
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const validApiKey = process.env.BROWSER_SERVICE_API_KEY;
  
  if (validApiKey && apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// 🎭 브라우저 매니저 클래스
class BrowserManager {
  constructor() {
    this.browsers = new Map();
    this.maxBrowsers = parseInt(process.env.MAX_BROWSERS) || 5;
    this.browserTimeout = parseInt(process.env.BROWSER_TIMEOUT) || 5 * 60 * 1000; // 5분
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 1분마다 정리
  }

  async getBrowser(browserType = 'chromium') {
    const key = `${browserType}_${Date.now()}`;
    
    try {
      const browserEngine = { chromium, firefox, webkit }[browserType];
      if (!browserEngine) {
        throw new Error(`Unsupported browser type: ${browserType}`);
      }

      console.log(`[BrowserManager] 새 브라우저 생성: ${browserType}`);
      
      const browser = await browserEngine.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
      });

      this.browsers.set(key, {
        browser,
        created: Date.now(),
        lastUsed: Date.now(),
        type: browserType
      });

      // 최대 브라우저 수 제한
      await this.enforceLimit();

      return { browser, key };
    } catch (error) {
      console.error(`[BrowserManager] 브라우저 생성 실패:`, error);
      throw error;
    }
  }

  async releaseBrowser(key) {
    const browserInfo = this.browsers.get(key);
    if (browserInfo) {
      try {
        await browserInfo.browser.close();
        this.browsers.delete(key);
        console.log(`[BrowserManager] 브라우저 해제: ${key}`);
      } catch (error) {
        console.error(`[BrowserManager] 브라우저 해제 실패:`, error);
      }
    }
  }

  async enforceLimit() {
    if (this.browsers.size <= this.maxBrowsers) return;

    const sortedBrowsers = Array.from(this.browsers.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    const toRemove = sortedBrowsers.slice(0, this.browsers.size - this.maxBrowsers);
    
    for (const [key, browserInfo] of toRemove) {
      await this.releaseBrowser(key);
    }
  }

  async cleanup() {
    const now = Date.now();
    const toRemove = [];

    for (const [key, browserInfo] of this.browsers) {
      if (now - browserInfo.lastUsed > this.browserTimeout) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      await this.releaseBrowser(key);
    }

    if (toRemove.length > 0) {
      console.log(`[BrowserManager] 정리 완료: ${toRemove.length}개 브라우저 해제`);
    }
  }

  async closeAll() {
    console.log(`[BrowserManager] 모든 브라우저 종료 중... (${this.browsers.size}개)`);
    
    const promises = Array.from(this.browsers.keys()).map(key => this.releaseBrowser(key));
    await Promise.allSettled(promises);
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log('[BrowserManager] 모든 브라우저 종료 완료');
  }

  getStats() {
    return {
      activeBrowsers: this.browsers.size,
      maxBrowsers: this.maxBrowsers,
      browsers: Array.from(this.browsers.entries()).map(([key, info]) => ({
        key,
        type: info.type,
        created: new Date(info.created).toISOString(),
        lastUsed: new Date(info.lastUsed).toISOString(),
        age: Date.now() - info.created
      }))
    };
  }
}

const browserManager = new BrowserManager();

// 📊 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    browserStats: browserManager.getStats()
  });
});

// 📊 상태 확인 엔드포인트
app.get('/api/status', authenticateApiKey, (req, res) => {
  res.json({
    service: 'screenflow-browser-service',
    version: '1.0.0',
    status: 'running',
    capabilities: {
      screenshot: true,
      flowCapture: true,
      batchCapture: true,
      supportedBrowsers: ['chromium', 'firefox', 'webkit']
    },
    limits: {
      maxBrowsers: browserManager.maxBrowsers,
      browserTimeout: browserManager.browserTimeout,
      requestTimeout: 60000
    },
    stats: browserManager.getStats()
  });
});

// 📸 스크린샷 캡처 엔드포인트
app.post('/api/capture', [
  authenticateApiKey,
  body('url').isURL().withMessage('Valid URL is required'),
  body('options.viewport.width').optional().isInt({ min: 320, max: 3840 }),
  body('options.viewport.height').optional().isInt({ min: 240, max: 2160 }),
  body('options.waitTime').optional().isInt({ min: 0, max: 30000 }),
  body('options.quality').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const { url, options = {} } = req.body;
  const requestId = uuidv4();
  let browserKey = null;

  console.log(`[${requestId}] 스크린샷 캡처 시작: ${url}`);

  try {
    const { browser, key } = await browserManager.getBrowser('chromium');
    browserKey = key;

    const context = await browser.newContext({
      viewport: options.viewport || { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    
    // 페이지 로드
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    // 대기 시간
    if (options.waitTime) {
      await page.waitForTimeout(options.waitTime);
    }

    // 스크린샷 캡처
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage || false,
      quality: options.quality || 90
    });

    const title = await page.title();
    const finalUrl = page.url();

    await context.close();

    console.log(`[${requestId}] 스크린샷 캡처 완료: ${title}`);

    res.json({
      success: true,
      data: {
        screenshot: screenshot.toString('base64'),
        metadata: {
          title,
          url: finalUrl,
          originalUrl: url,
          timestamp: new Date().toISOString(),
          viewport: options.viewport || { width: 1440, height: 900 },
          requestId
        }
      }
    });

  } catch (error) {
    console.error(`[${requestId}] 스크린샷 캡처 실패:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      requestId
    });
  } finally {
    if (browserKey) {
      await browserManager.releaseBrowser(browserKey);
    }
  }
});

// 🔄 플로우 캡처 엔드포인트
app.post('/api/flow-capture', [
  authenticateApiKey,
  body('url').isURL().withMessage('Valid URL is required'),
  body('maxSteps').optional().isInt({ min: 1, max: 10 }),
  body('waitTime').optional().isInt({ min: 1000, max: 10000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const { 
    url, 
    maxSteps = 5, 
    triggerKeywords = ['다음', '시작', 'Next', 'Start', 'Continue', '계속'],
    waitTime = 3000 
  } = req.body;
  
  const requestId = uuidv4();
  let browserKey = null;

  console.log(`[${requestId}] 플로우 캡처 시작: ${url} (최대 ${maxSteps}단계)`);

  try {
    const { browser, key } = await browserManager.getBrowser('chromium');
    browserKey = key;

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const screenshots = [];

    // 1단계: 초기 페이지 로딩
    console.log(`[${requestId}] 1단계: 초기 페이지 로딩`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(waitTime);

    const initialScreenshot = await page.screenshot({ type: 'png' });
    const initialTitle = await page.title();

    screenshots.push({
      step: 1,
      title: initialTitle,
      url: page.url(),
      screenshot: initialScreenshot.toString('base64')
    });

    // 2단계부터: 트리거 버튼 찾기 및 클릭
    for (let step = 2; step <= maxSteps; step++) {
      console.log(`[${requestId}] ${step}단계: 트리거 버튼 찾기`);

      let clicked = false;
      
      // 키워드 기반 버튼/링크 찾기
      for (const keyword of triggerKeywords) {
        try {
          const selector = `a:has-text("${keyword}"), button:has-text("${keyword}"), [role="button"]:has-text("${keyword}")`;
          const element = await page.locator(selector).first();
          
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`[${requestId}] ${step}단계: "${keyword}" 버튼/링크 클릭`);
            await element.click();
            clicked = true;
            break;
          }
        } catch (error) {
          // 해당 키워드로 요소를 찾지 못함, 다음 키워드 시도
          continue;
        }
      }

      if (!clicked) {
        console.log(`[${requestId}] ${step}단계: 트리거 요소를 찾을 수 없음, 플로우 종료`);
        break;
      }

      // 페이지 로딩 대기
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        // 네트워크가 완전히 idle 상태가 되지 않을 수 있음
        await page.waitForTimeout(waitTime);
      }

      // 스크린샷 캡처
      const screenshot = await page.screenshot({ type: 'png' });
      const title = await page.title();

      screenshots.push({
        step,
        title,
        url: page.url(),
        screenshot: screenshot.toString('base64')
      });

      console.log(`[${requestId}] ${step}단계: 캡처 완료 - ${title}`);
    }

    await context.close();

    console.log(`[${requestId}] 플로우 캡처 완료: 총 ${screenshots.length}개 스크린샷`);

    res.json({
      success: true,
      data: {
        screenshots,
        totalSteps: screenshots.length,
        requestId
      }
    });

  } catch (error) {
    console.error(`[${requestId}] 플로우 캡처 실패:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      requestId
    });
  } finally {
    if (browserKey) {
      await browserManager.releaseBrowser(browserKey);
    }
  }
});

// 📦 배치 캡처 엔드포인트
app.post('/api/batch-capture', [
  authenticateApiKey,
  body('urls').isArray({ min: 1, max: 10 }).withMessage('URLs array is required (max 10)'),
  body('urls.*').isURL().withMessage('All URLs must be valid')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const { urls, options = {} } = req.body;
  const requestId = uuidv4();

  console.log(`[${requestId}] 배치 캡처 시작: ${urls.length}개 URL`);

  try {
    const results = await Promise.allSettled(
      urls.map(async (url, index) => {
        const { browser, key } = await browserManager.getBrowser('chromium');
        
        try {
          const context = await browser.newContext({
            viewport: options.viewport || { width: 1440, height: 900 }
          });

          const page = await context.newPage();
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          
          if (options.waitTime) {
            await page.waitForTimeout(options.waitTime);
          }

          const screenshot = await page.screenshot({
            type: 'png',
            fullPage: options.fullPage || false
          });

          const title = await page.title();
          await context.close();

          return {
            success: true,
            url,
            index,
            data: {
              screenshot: screenshot.toString('base64'),
              metadata: {
                title,
                url: page.url(),
                originalUrl: url,
                timestamp: new Date().toISOString()
              }
            }
          };
        } finally {
          await browserManager.releaseBrowser(key);
        }
      })
    );

    const processedResults = results.map((result, index) => ({
      url: urls[index],
      index,
      success: result.status === 'fulfilled' && result.value.success,
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' 
        ? result.reason.message 
        : result.status === 'fulfilled' && !result.value.success 
          ? result.value.error 
          : null
    }));

    const successCount = processedResults.filter(r => r.success).length;
    
    console.log(`[${requestId}] 배치 캡처 완료: ${successCount}/${urls.length} 성공`);

    res.json({
      success: true,
      data: processedResults,
      summary: {
        total: urls.length,
        successful: successCount,
        failed: urls.length - successCount,
        requestId
      }
    });

  } catch (error) {
    console.error(`[${requestId}] 배치 캡처 실패:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      requestId
    });
  }
});

// 🚫 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/status',
      'POST /api/capture',
      'POST /api/flow-capture',
      'POST /api/batch-capture'
    ]
  });
});

// 🚨 에러 핸들러
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 🚀 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ScreenFlow Browser Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎭 Max browsers: ${browserManager.maxBrowsers}`);
  console.log(`⏱️  Browser timeout: ${browserManager.browserTimeout}ms`);
});

// 🛑 Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    await browserManager.closeAll();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  server.close(async () => {
    await browserManager.closeAll();
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
