import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('[Test Supabase] 연결 테스트 시작');
    
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('[Test Supabase] 환경변수 확인:', {
      url: supabaseUrl,
      anonKeyExists: !!supabaseAnonKey,
      serviceKeyExists: !!supabaseServiceKey,
      anonKeyLength: supabaseAnonKey?.length,
      serviceKeyLength: supabaseServiceKey?.length
    });
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: '환경변수가 설정되지 않았습니다.',
        details: {
          url: !!supabaseUrl,
          anonKey: !!supabaseAnonKey,
          serviceKey: !!supabaseServiceKey
        }
      }, { status: 500 });
    }
    
    // 클라이언트 연결 테스트
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 클라이언트를 생성할 수 없습니다.'
      }, { status: 500 });
    }
    
    // 간단한 쿼리로 연결 테스트
    console.log('[Test Supabase] 데이터베이스 연결 테스트 중...');
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    console.log('[Test Supabase] 쿼리 결과:', { data, error });
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: '데이터베이스 연결 실패',
        details: error.message,
        supabaseError: error
      }, { status: 500 });
    }
    
    // Admin 클라이언트 테스트
    let adminTest = null;
    if (supabaseAdmin) {
      try {
        const { data: adminData, error: adminError } = await supabaseAdmin
          .from('users')
          .select('count')
          .limit(1);
        
        adminTest = {
          success: !adminError,
          error: adminError?.message
        };
      } catch (adminErr) {
        adminTest = {
          success: false,
          error: adminErr instanceof Error ? adminErr.message : 'Admin 클라이언트 오류'
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Supabase 연결이 정상입니다.',
      details: {
        url: supabaseUrl,
        clientConnected: !!supabase,
        adminConnected: !!supabaseAdmin,
        queryResult: data,
        adminTest
      }
    });
    
  } catch (err) {
    console.error('[Test Supabase] 예외 발생:', err);
    
    return NextResponse.json({
      success: false,
      error: '연결 테스트 중 오류가 발생했습니다.',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
