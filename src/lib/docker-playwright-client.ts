// 🐳 Docker Playwright Service Client
// 완전한 제어가 가능한 브라우저 서비스와의 통신

interface ScreenshotOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  delay?: number;
  waitForSelector?: string;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  animations?: 'disabled' | 'allow';
  colorScheme?: 'light' | 'dark' | 'no-preference';
}

interface ScreenshotResult {
  success: boolean;
  screenshot?: string;
  metadata?: {
    url: string;
    timestamp: string;
    duration: number;
    browser: string;
    viewport: {
      width: number;
      height: number;
    };
    format: string;
    size: number;
  };
  error?: string;
}

interface BatchScreenshotResult {
  success: boolean;
  results: Array<{
    url: string;
    success: boolean;
    data: ScreenshotResult | null;
    error: string | null;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface BrowserStatus {
  browsers: Array<{
    type: string;
    lastUsed: string;
    age: number;
  }>;
  count: number;
  maxBrowsers: number;
}

class DockerPlaywrightClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 끝의 슬래시 제거
    this.timeout = 60000; // 60초
    this.retries = 3;
  }

  /**
   * 🖼️ 단일 URL 스크린샷 캡처
   */
  async captureScreenshot(url: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const endpoint = `${this.baseUrl}/screenshot`;
    
    const payload = {
      url,
      options: {
        browser: 'chromium',
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        fullPage: false,
        format: 'png',
        quality: 90,
        timeout: 30000,
        waitUntil: 'networkidle',
        delay: 0,
        animations: 'disabled',
        colorScheme: 'light',
        ...options
      }
    };

    return this.makeRequest(endpoint, payload);
  }

  /**
   * 📦 배치 스크린샷 캡처 (최대 5개 URL)
   */
  async captureBatchScreenshots(
    urls: string[], 
    options: ScreenshotOptions = {}
  ): Promise<BatchScreenshotResult> {
    if (urls.length === 0) {
      throw new Error('URLs array cannot be empty');
    }

    if (urls.length > 5) {
      throw new Error('Maximum 5 URLs allowed per batch');
    }

    const endpoint = `${this.baseUrl}/screenshot/batch`;
    
    const payload = {
      urls,
      options: {
        browser: 'chromium',
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        fullPage: false,
        format: 'png',
        quality: 90,
        timeout: 30000,
        waitUntil: 'networkidle',
        delay: 0,
        animations: 'disabled',
        colorScheme: 'light',
        ...options
      }
    };

    return this.makeRequest(endpoint, payload);
  }

  /**
   * 🔍 브라우저 상태 확인
   */
  async getBrowserStatus(): Promise<BrowserStatus> {
    const endpoint = `${this.baseUrl}/browsers`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Browser status check failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 💓 헬스체크
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    memory: any;
    browsers: number;
  }> {
    const endpoint = `${this.baseUrl}/health`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 🔄 재시도 로직이 포함된 HTTP 요청
   */
  private async makeRequest(endpoint: string, payload: any, attempt: number = 1): Promise<any> {
    try {
      console.log(`[DockerPlaywright] Request attempt ${attempt}/${this.retries} to ${endpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ScreenFlow/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`[DockerPlaywright] Request successful:`, {
        url: payload.url || 'batch',
        duration: result.metadata?.duration || 'unknown',
        browser: result.metadata?.browser || 'unknown'
      });

      return result;

    } catch (error) {
      console.error(`[DockerPlaywright] Request failed (attempt ${attempt}):`, error);

      // 재시도 조건 확인
      if (attempt < this.retries && this.shouldRetry(error)) {
        const delay = Math.pow(2, attempt) * 1000; // 지수 백오프
        console.log(`[DockerPlaywright] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, payload, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * 🤔 재시도 여부 판단
   */
  private shouldRetry(error: any): boolean {
    // 네트워크 오류나 서버 오류는 재시도
    if (error.name === 'AbortError') return true;
    if (error.message.includes('fetch')) return true;
    if (error.message.includes('HTTP 5')) return true;
    if (error.message.includes('timeout')) return true;
    
    // 클라이언트 오류는 재시도하지 않음
    if (error.message.includes('HTTP 4')) return false;
    
    return true;
  }

  /**
   * ⚙️ 설정 업데이트
   */
  updateConfig(config: {
    baseUrl?: string;
    timeout?: number;
    retries?: number;
  }) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }
    if (config.timeout) {
      this.timeout = config.timeout;
    }
    if (config.retries) {
      this.retries = config.retries;
    }
  }
}

// 🌟 싱글톤 인스턴스
const dockerPlaywrightClient = new DockerPlaywrightClient(
  process.env.NEXT_PUBLIC_PLAYWRIGHT_SERVICE_URL || 'http://localhost:3001'
);

export { dockerPlaywrightClient, DockerPlaywrightClient };
export type { ScreenshotOptions, ScreenshotResult, BatchScreenshotResult, BrowserStatus };
