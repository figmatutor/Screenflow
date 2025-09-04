// 🌐 네트워크 연결 테스트 API

import { NextRequest, NextResponse } from 'next/server';
import { testNetworkConnection, runNetworkDiagnostics } from '@/lib/network-test';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const diagnostic = searchParams.get('diagnostic') === 'true';

    console.log('[Test Network] 네트워크 테스트 요청:', { url, diagnostic });

    if (diagnostic) {
      // 종합 네트워크 진단
      const diagnostics = await runNetworkDiagnostics(url || undefined);
      
      return NextResponse.json({
        success: true,
        type: 'diagnostic',
        data: diagnostics,
        timestamp: new Date().toISOString()
      });
    } else if (url) {
      // 특정 URL 테스트
      const result = await testNetworkConnection(url);
      
      return NextResponse.json({
        success: true,
        type: 'single',
        data: result,
        timestamp: new Date().toISOString()
      });
    } else {
      // 기본 연결성 테스트
      const testUrls = [
        'https://www.google.com',
        'https://httpbin.org/status/200',
        'https://www.github.com'
      ];

      const results = await Promise.all(
        testUrls.map(testUrl => testNetworkConnection(testUrl))
      );

      const successCount = results.filter(r => r.success).length;

      return NextResponse.json({
        success: successCount > 0,
        type: 'basic',
        data: {
          results,
          successCount,
          totalCount: results.length,
          overallStatus: successCount > 0 ? 'connected' : 'disconnected'
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[Test Network] 네트워크 테스트 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, timeout = 10000 } = body;

    console.log('[Test Network] 다중 URL 테스트:', { urls, timeout });

    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('URLs 배열이 필요합니다.');
    }

    const results = await Promise.all(
      urls.map(url => testNetworkConnection(url, timeout))
    );

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      data: {
        results,
        successCount,
        totalCount: results.length,
        averageResponseTime: results
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(successCount, 1)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Test Network] 다중 URL 테스트 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
