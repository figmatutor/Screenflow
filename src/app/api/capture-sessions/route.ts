import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, CaptureSession } from '@/lib/supabase'

// GET: 캡처 세션 목록 조회
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const userId = searchParams.get('user_id')

    let query = supabaseAdmin
      .from('capture_sessions')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    // 필터 적용
    if (status) {
      query = query.eq('status', status)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('캡처 세션 조회 오류:', error)
      return NextResponse.json(
        { error: '캡처 세션 데이터를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sessions,
      pagination: {
        limit,
        offset,
        total: sessions?.length || 0
      }
    })

  } catch (error) {
    console.error('GET /api/capture-sessions 오류:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 새 캡처 세션 생성
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { session_id, url, user_id, status = 'processing' } = body as Partial<CaptureSession>

    // 입력 검증
    if (!session_id || !url) {
      return NextResponse.json(
        { error: 'session_id와 url은 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // 새 캡처 세션 생성
    const { data: newSession, error } = await supabaseAdmin
      .from('capture_sessions')
      .insert([
        {
          session_id,
          url,
          user_id,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('캡처 세션 생성 오류:', error)
      return NextResponse.json(
        { error: '캡처 세션 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { session: newSession, message: '캡처 세션이 성공적으로 생성되었습니다.' },
      { status: 201 }
    )

  } catch (error) {
    console.error('POST /api/capture-sessions 오류:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// OPTIONS: CORS 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
