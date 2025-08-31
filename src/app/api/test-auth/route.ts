import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('[Test Auth] 인증 테스트 시작:', { email });
    
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 클라이언트가 없습니다.'
      }, { status: 500 });
    }
    
    // 로그인 시도
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    console.log('[Test Auth] 인증 결과:', {
      success: !error,
      error: error?.message,
      user: data?.user?.email
    });
    
    return NextResponse.json({
      success: !error,
      error: error?.message,
      user: data?.user ? {
        id: data.user.id,
        email: data.user.email,
        confirmed_at: data.user.email_confirmed_at
      } : null,
      session: data?.session ? {
        access_token: !!data.session.access_token,
        refresh_token: !!data.session.refresh_token
      } : null
    });
    
  } catch (err) {
    console.error('[Test Auth] 예외 발생:', err);
    
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 클라이언트가 없습니다.'
      });
    }
    
    // 현재 세션 확인
    const { data: { session }, error } = await supabase.auth.getSession();
    
    return NextResponse.json({
      success: true,
      hasSession: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email
      } : null
    });
    
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
