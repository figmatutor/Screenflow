const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { chromium, firefox, webkit } = require('playwright');
const winston = require('winston');
const Joi = require('joi');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// 🚀 Express 앱 설정
const app = express();
const PORT = process.env.PORT || 3001;

// 📊 로깅 설정
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 🛡️ 보안 및 미들웨어
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://screenflow.pro'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json({ limit: '10mb' }));

// 🚦 Rate Limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Try again later.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
});

// 📝 요청 검증 스키마
const screenshotSchema = Joi.object({
  url: Joi.string().uri().required(),
  options: Joi.object({
    browser: Joi.string().valid('chromium', 'firefox', 'webkit').default('chromium'),
    width: Joi.number().integer().min(100).max(4000).default(1920),
    height: Joi.number().integer().min(100).max(4000).default(1080),
    deviceScaleFactor: Joi.number().min(0.1).max(3).default(1),
    fullPage: Joi.boolean().default(false),
    format: Joi.string().valid('png', 'jpeg').default('png'),
    quality: Joi.number().integer().min(1).max(100).default(90),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000),
    waitUntil: Joi.string().valid('load', 'domcontentloaded', 'networkidle').default('networkidle'),
    delay: Joi.number().integer().min(0).max(10000).default(0),
    waitForSelector: Joi.string().allow(''),
    clip: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().required(),
      height: Joi.number().required()
    }),
    animations: Joi.string().valid('disabled', 'allow').default('disabled'),
    colorScheme: Joi.string().valid('light', 'dark', 'no-preference').default('light')
  }).default({})
});

// 🎭 브라우저 인스턴스 관리
class BrowserManager {
  constructor() {
    this.browsers = new Map();
    this.maxBrowsers = 3;
    this.browserTimeout = 5 * 60 * 1000; // 5분
  }

  async getBrowser(browserType = 'chromium') {
    const key = browserType;
    
    if (this.browsers.has(key)) {
      const { browser, lastUsed } = this.browsers.get(key);
      
      // 브라우저가 너무 오래되었으면 재시작
      if (Date.now() - lastUsed > this.browserTimeout) {
        await browser.close();
        this.browsers.delete(key);
      } else {
        this.browsers.set(key, { browser, lastUsed: Date.now() });
        return browser;
      }
    }

    // 새 브라우저 생성
    const browserEngine = { chromium, firefox, webkit }[browserType];
    const browser = await browserEngine.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    });

    this.browsers.set(key, { browser, lastUsed: Date.now() });
    
    // 최대 브라우저 수 제한
    if (this.browsers.size > this.maxBrowsers) {
      const oldestKey = Array.from(this.browsers.keys())[0];
      const { browser: oldBrowser } = this.browsers.get(oldestKey);
      await oldBrowser.close();
      this.browsers.delete(oldestKey);
    }

    return browser;
  }

  async closeAll() {
    for (const [key, { browser }] of this.browsers) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

const browserManager = new BrowserManager();

// 🖼️ 스크린샷 캡처 함수
async function captureScreenshot(url, options = {}) {
  const startTime = Date.now();
  let browser, context, page;

  try {
    logger.info(`Starting screenshot capture for: ${url}`);

    // 브라우저 가져오기
    browser = await browserManager.getBrowser(options.browser);
    
    // 컨텍스트 생성
    context = await browser.newContext({
      viewport: {
        width: options.width,
        height: options.height
      },
      deviceScaleFactor: options.deviceScaleFactor,
      colorScheme: options.colorScheme,
      reducedMotion: options.animations === 'disabled' ? 'reduce' : 'no-preference'
    });

    // 페이지 생성
    page = await context.newPage();

    // 페이지 로드
    await page.goto(url, {
      waitUntil: options.waitUntil,
      timeout: options.timeout
    });

    // 추가 대기
    if (options.delay > 0) {
      await page.waitForTimeout(options.delay);
    }

    // 특정 요소 대기
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    // 스크린샷 옵션 설정
    const screenshotOptions = {
      type: options.format,
      fullPage: options.fullPage
    };

    if (options.format === 'jpeg') {
      screenshotOptions.quality = options.quality;
    }

    if (options.clip) {
      screenshotOptions.clip = options.clip;
    }

    // 스크린샷 캡처
    const screenshot = await page.screenshot(screenshotOptions);

    const duration = Date.now() - startTime;
    logger.info(`Screenshot captured successfully in ${duration}ms`);

    return {
      success: true,
      screenshot: screenshot.toString('base64'),
      metadata: {
        url,
        timestamp: new Date().toISOString(),
        duration,
        browser: options.browser,
        viewport: {
          width: options.width,
          height: options.height
        },
        format: options.format,
        size: screenshot.length
      }
    };

  } catch (error) {
    logger.error('Screenshot capture failed:', error);
    throw error;
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
}

// 🌐 API 엔드포인트들

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    browsers: browserManager.browsers.size
  });
});

// 스크린샷 캡처
app.post('/screenshot', async (req, res) => {
  try {
    // 요청 검증
    const { error, value } = screenshotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const { url, options } = value;

    // 스크린샷 캡처
    const result = await captureScreenshot(url, options);

    res.json(result);

  } catch (error) {
    logger.error('Screenshot API error:', error);
    
    res.status(500).json({
      error: 'Screenshot Failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 배치 스크린샷 (여러 URL 동시 처리)
app.post('/screenshot/batch', async (req, res) => {
  try {
    const { urls, options = {} } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: 'Invalid Input',
        message: 'urls must be a non-empty array'
      });
    }

    if (urls.length > 5) {
      return res.status(400).json({
        error: 'Too Many URLs',
        message: 'Maximum 5 URLs per batch request'
      });
    }

    // 병렬 처리
    const results = await Promise.allSettled(
      urls.map(url => captureScreenshot(url, options))
    );

    const response = results.map((result, index) => ({
      url: urls[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));

    res.json({
      success: true,
      results: response,
      summary: {
        total: urls.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    logger.error('Batch screenshot error:', error);
    res.status(500).json({
      error: 'Batch Screenshot Failed',
      message: error.message
    });
  }
});

// 브라우저 상태 확인
app.get('/browsers', (req, res) => {
  const browsers = Array.from(browserManager.browsers.entries()).map(([type, { lastUsed }]) => ({
    type,
    lastUsed: new Date(lastUsed).toISOString(),
    age: Date.now() - lastUsed
  }));

  res.json({
    browsers,
    count: browsers.length,
    maxBrowsers: browserManager.maxBrowsers
  });
});

// 🚨 에러 핸들링
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found'
  });
});

// 🎬 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🎭 Playwright Screenshot Service running on port ${PORT}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
});

// 🛑 Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await browserManager.closeAll();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await browserManager.closeAll();
    process.exit(0);
  });
});

module.exports = app;
