import { NextRequest, NextResponse } from 'next/server';

// 완전히 순수한 테스트 API (어떤 라이브러리도 import하지 않음)
export async function GET() {
  return NextResponse.json({ 
    method: 'GET',
    message: 'Pure API working!',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({ 
      method: 'POST',
      message: 'Pure API POST working!',
      receivedData: body,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'vercel' : 'local'
    });
  } catch (error) {
    return NextResponse.json({ 
      method: 'POST',
      message: 'Pure API POST working (no JSON)!',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'vercel' : 'local'
    }, { status: 200 });
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
