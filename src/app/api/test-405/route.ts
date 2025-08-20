import { NextRequest, NextResponse } from 'next/server';

// 아주 간단한 405 테스트용 API
export async function GET() {
  return NextResponse.json({ 
    method: 'GET', 
    message: 'GET method working',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ 
      method: 'POST', 
      message: 'POST method working',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      method: 'POST', 
      message: 'POST method working (no JSON body)',
      timestamp: new Date().toISOString()
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
