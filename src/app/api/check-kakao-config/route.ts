import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || 'http://localhost:3001';
  const host = request.headers.get('host') || 'localhost:3001';
  
  return NextResponse.json({
    currentOrigin: origin,
    currentHost: host,
    currentScopes: 'profile_nickname account_email',
    removedScopes: ['profile_image', 'openid'],
    expectedRedirectUrls: {
      development: 'http://localhost:3001/auth/callback',
      production: 'https://screenflow.pro/auth/callback',
      supabaseCallback: 'https://cpaqhythcmolwbdlygen.supabase.co/auth/v1/callback'
    },
    instructions: {
      kakaoConsole: [
        '1. https://developers.kakao.com 접속',
        '2. 내 애플리케이션 → 앱 선택',
        '3. 카카오 로그인 → Redirect URI',
        '4. 위 expectedRedirectUrls의 development, production 추가'
      ],
      supabaseDashboard: [
        '1. Supabase 대시보드 → cpaqhythcmolwbdlygen 프로젝트',
        '2. Authentication → Providers → Kakao',
        '3. Redirect URL에 supabaseCallback URL 입력'
      ],
      kakaoScopes: [
        '현재 요청 스코프: profile_nickname account_email',
        '제거된 스코프: profile_image (KOE205 방지)',
        '카카오 콘솔에서 프로필 사진을 "사용 안함"으로 설정하세요'
      ]
    }
  });
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
