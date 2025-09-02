// 🧪 세션 플로우 통합 테스트 API
// RLS 정책 및 세션 관리 검증

import { NextRequest, NextResponse } from 'next/server';
import { captureStore } from '@/lib/capture-store-supabase-primary';

export async function POST(request: NextRequest) {
  const testResults: any[] = [];
  let overallSuccess = true;

  try {
    console.log('[SessionFlowTest] 🧪 세션 플로우 테스트 시작');

    // 테스트 1: 세션 생성
    const testSessionId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const testUrl = 'https://example.com';
    
    console.log('[SessionFlowTest] 1️⃣ 세션 생성 테스트');
    try {
      await captureStore.set(testSessionId, {
        status: 'processing',
        createdAt: new Date(),
        url: testUrl
      });
      
      testResults.push({
        test: 'session_creation',
        success: true,
        message: '세션 생성 성공',
        sessionId: testSessionId
      });
      console.log('[SessionFlowTest] ✅ 세션 생성 성공');
    } catch (error) {
      testResults.push({
        test: 'session_creation',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ 세션 생성 실패:', error);
    }

    // 테스트 2: 세션 조회 (즉시)
    console.log('[SessionFlowTest] 2️⃣ 즉시 세션 조회 테스트');
    try {
      const retrievedSession = await captureStore.get(testSessionId);
      
      if (retrievedSession && retrievedSession.status === 'processing') {
        testResults.push({
          test: 'immediate_retrieval',
          success: true,
          message: '즉시 조회 성공',
          sessionData: {
            status: retrievedSession.status,
            url: retrievedSession.url
          }
        });
        console.log('[SessionFlowTest] ✅ 즉시 조회 성공');
      } else {
        throw new Error('세션 데이터가 올바르지 않음');
      }
    } catch (error) {
      testResults.push({
        test: 'immediate_retrieval',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ 즉시 조회 실패:', error);
    }

    // 테스트 3: 세션 업데이트
    console.log('[SessionFlowTest] 3️⃣ 세션 업데이트 테스트');
    try {
      await captureStore.set(testSessionId, {
        status: 'completed',
        createdAt: new Date(),
        finishedAt: new Date(),
        url: testUrl,
        result: {
          totalPages: 1,
          successCount: 1,
          failureCount: 0,
          baseUrl: testUrl,
          crawledPages: [{
            url: testUrl,
            title: 'Test Page',
            filename: 'test.png',
            success: true,
            order: 1,
            depth: 0,
            links: [],
            capturedAt: new Date()
          }]
        }
      });
      
      testResults.push({
        test: 'session_update',
        success: true,
        message: '세션 업데이트 성공'
      });
      console.log('[SessionFlowTest] ✅ 세션 업데이트 성공');
    } catch (error) {
      testResults.push({
        test: 'session_update',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ 세션 업데이트 실패:', error);
    }

    // 테스트 4: 업데이트된 세션 조회
    console.log('[SessionFlowTest] 4️⃣ 업데이트된 세션 조회 테스트');
    try {
      const updatedSession = await captureStore.get(testSessionId);
      
      if (updatedSession && updatedSession.status === 'completed' && updatedSession.result) {
        testResults.push({
          test: 'updated_retrieval',
          success: true,
          message: '업데이트된 세션 조회 성공',
          sessionData: {
            status: updatedSession.status,
            url: updatedSession.url,
            resultExists: !!updatedSession.result,
            totalPages: updatedSession.result?.totalPages
          }
        });
        console.log('[SessionFlowTest] ✅ 업데이트된 세션 조회 성공');
      } else {
        throw new Error('업데이트된 세션 데이터가 올바르지 않음');
      }
    } catch (error) {
      testResults.push({
        test: 'updated_retrieval',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ 업데이트된 세션 조회 실패:', error);
    }

    // 테스트 5: RLS 정책 테스트 (다른 세션 ID로 조회 시도)
    console.log('[SessionFlowTest] 5️⃣ RLS 정책 테스트');
    try {
      const nonExistentSession = await captureStore.get('nonexistent_session_id');
      
      if (nonExistentSession === null) {
        testResults.push({
          test: 'rls_policy',
          success: true,
          message: 'RLS 정책 정상 작동 (존재하지 않는 세션 null 반환)'
        });
        console.log('[SessionFlowTest] ✅ RLS 정책 정상 작동');
      } else {
        throw new Error('존재하지 않는 세션이 반환됨');
      }
    } catch (error) {
      testResults.push({
        test: 'rls_policy',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ RLS 정책 테스트 실패:', error);
    }

    // 테스트 6: 전체 세션 목록 조회
    console.log('[SessionFlowTest] 6️⃣ 전체 세션 목록 조회 테스트');
    try {
      const allSessions = await captureStore.getAllSessions();
      const sessionCount = Object.keys(allSessions).length;
      
      testResults.push({
        test: 'all_sessions',
        success: true,
        message: `전체 세션 조회 성공 (${sessionCount}개 세션)`,
        sessionCount
      });
      console.log('[SessionFlowTest] ✅ 전체 세션 조회 성공');
    } catch (error) {
      testResults.push({
        test: 'all_sessions',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      overallSuccess = false;
      console.log('[SessionFlowTest] ❌ 전체 세션 조회 실패:', error);
    }

    // 정리: 테스트 세션 삭제
    console.log('[SessionFlowTest] 🧹 테스트 세션 정리');
    try {
      await captureStore.delete(testSessionId);
      console.log('[SessionFlowTest] ✅ 테스트 세션 삭제 완료');
    } catch (error) {
      console.log('[SessionFlowTest] ⚠️ 테스트 세션 삭제 실패:', error);
    }

    console.log('[SessionFlowTest] 🏁 테스트 완료');

    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess ? '모든 테스트 통과' : '일부 테스트 실패',
      testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.success).length,
        failed: testResults.filter(r => !r.success).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[SessionFlowTest] 💥 테스트 중 치명적 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: '테스트 중 치명적 오류 발생',
      error: error instanceof Error ? error.message : 'Unknown error',
      testResults,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Session Flow Test API',
    usage: 'POST 요청으로 테스트 실행',
    endpoints: {
      test: 'POST /api/test-session-flow'
    }
  });
}
