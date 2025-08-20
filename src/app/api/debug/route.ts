import { NextRequest, NextResponse } from 'next/server';
import { captureStore } from '@/lib/capture-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (sessionId) {
      // 특정 세션 정보 반환
      const session = captureStore.get(sessionId);
      return NextResponse.json({
        sessionId,
        session: session || null,
        found: !!session
      });
    } else {
      // 모든 세션 정보 반환
      const allSessions = captureStore.getAllSessions();
      return NextResponse.json({
        totalSessions: Object.keys(allSessions).length,
        sessions: allSessions
      });
    }
    
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
