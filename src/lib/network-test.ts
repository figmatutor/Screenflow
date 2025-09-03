// 🌐 네트워크 연결 테스트 유틸리티

export interface NetworkTestResult {
  success: boolean;
  url: string;
  responseTime: number;
  statusCode?: number;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * 네트워크 연결 상태 테스트
 */
export async function testNetworkConnection(url: string, timeout: number = 10000): Promise<NetworkTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[NetworkTest] 연결 테스트 시작: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD', // HEAD 요청으로 빠른 테스트
      signal: controller.signal,
      headers: {
        'User-Agent': 'ScreenFlow-NetworkTest/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    const result: NetworkTestResult = {
      success: response.ok,
      url,
      responseTime,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
    
    console.log(`[NetworkTest] 연결 성공: ${url} (${responseTime}ms, ${response.status})`);
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    const result: NetworkTestResult = {
      success: false,
      url,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    console.error(`[NetworkTest] 연결 실패: ${url} (${responseTime}ms)`, error);
    return result;
  }
}

/**
 * 여러 URL에 대한 연결 테스트
 */
export async function testMultipleConnections(urls: string[]): Promise<NetworkTestResult[]> {
  console.log(`[NetworkTest] 다중 연결 테스트 시작: ${urls.length}개 URL`);
  
  const promises = urls.map(url => testNetworkConnection(url));
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        url: urls[index],
        responseTime: 0,
        error: result.reason?.message || 'Promise rejected'
      };
    }
  });
}

/**
 * 일반적인 웹사이트들로 연결 테스트
 */
export async function testCommonSites(): Promise<NetworkTestResult[]> {
  const testUrls = [
    'https://www.google.com',
    'https://www.naver.com',
    'https://www.github.com',
    'https://httpbin.org/status/200'
  ];
  
  return testMultipleConnections(testUrls);
}

/**
 * DNS 해상도 테스트
 */
export async function testDNSResolution(hostname: string): Promise<{ success: boolean; ip?: string; error?: string }> {
  try {
    console.log(`[NetworkTest] DNS 해상도 테스트: ${hostname}`);
    
    // Node.js 환경에서만 사용 가능
    if (typeof window === 'undefined') {
      const dns = require('dns').promises;
      const addresses = await dns.resolve4(hostname);
      
      console.log(`[NetworkTest] DNS 해상도 성공: ${hostname} -> ${addresses[0]}`);
      return { success: true, ip: addresses[0] };
    } else {
      // 브라우저 환경에서는 fetch로 간접 테스트
      const result = await testNetworkConnection(`https://${hostname}`);
      return { success: result.success, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown DNS error';
    console.error(`[NetworkTest] DNS 해상도 실패: ${hostname}`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 프록시 설정 감지
 */
export function detectProxySettings(): { hasProxy: boolean; proxyInfo?: any } {
  try {
    // 환경 변수에서 프록시 설정 확인
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    
    const hasProxy = !!(httpProxy || httpsProxy);
    
    if (hasProxy) {
      console.log(`[NetworkTest] 프록시 설정 감지:`, {
        http: httpProxy,
        https: httpsProxy,
        noProxy
      });
    }
    
    return {
      hasProxy,
      proxyInfo: hasProxy ? {
        http: httpProxy,
        https: httpsProxy,
        noProxy
      } : undefined
    };
  } catch (error) {
    console.error(`[NetworkTest] 프록시 설정 확인 실패:`, error);
    return { hasProxy: false };
  }
}

/**
 * 종합 네트워크 진단
 */
export async function runNetworkDiagnostics(targetUrl?: string): Promise<{
  overall: boolean;
  tests: {
    connectivity: NetworkTestResult[];
    dns?: { success: boolean; ip?: string; error?: string };
    proxy: { hasProxy: boolean; proxyInfo?: any };
    target?: NetworkTestResult;
  };
  recommendations: string[];
}> {
  console.log(`[NetworkTest] 종합 네트워크 진단 시작`);
  
  const results = {
    overall: false,
    tests: {
      connectivity: [] as NetworkTestResult[],
      dns: undefined as any,
      proxy: detectProxySettings(),
      target: undefined as NetworkTestResult | undefined
    },
    recommendations: [] as string[]
  };
  
  try {
    // 1. 기본 연결성 테스트
    results.tests.connectivity = await testCommonSites();
    const successfulConnections = results.tests.connectivity.filter(r => r.success).length;
    
    // 2. DNS 테스트
    if (targetUrl) {
      const hostname = new URL(targetUrl).hostname;
      results.tests.dns = await testDNSResolution(hostname);
      
      // 3. 대상 URL 테스트
      results.tests.target = await testNetworkConnection(targetUrl);
    }
    
    // 4. 전체 상태 판단
    results.overall = successfulConnections > 0;
    
    // 5. 권장사항 생성
    if (successfulConnections === 0) {
      results.recommendations.push('인터넷 연결을 확인해주세요.');
      results.recommendations.push('방화벽 설정을 확인해주세요.');
    }
    
    if (results.tests.proxy.hasProxy) {
      results.recommendations.push('프록시 설정이 감지되었습니다. 프록시 설정을 확인해주세요.');
    }
    
    if (results.tests.dns && !results.tests.dns.success) {
      results.recommendations.push('DNS 해상도 문제가 있습니다. DNS 설정을 확인해주세요.');
    }
    
    if (results.tests.target && !results.tests.target.success) {
      results.recommendations.push(`대상 사이트(${targetUrl})에 접근할 수 없습니다.`);
    }
    
    console.log(`[NetworkTest] 진단 완료:`, {
      overall: results.overall,
      successful: successfulConnections,
      total: results.tests.connectivity.length
    });
    
  } catch (error) {
    console.error(`[NetworkTest] 진단 중 오류:`, error);
    results.recommendations.push('네트워크 진단 중 오류가 발생했습니다.');
  }
  
  return results;
}
