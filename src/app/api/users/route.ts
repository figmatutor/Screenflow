import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, User } from '@/lib/supabase'

// GET: 모든 사용자 조회
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('사용자 조회 오류:', error)
      return NextResponse.json(
        { error: '사용자 데이터를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      users,
      pagination: {
        limit,
        offset,
        total: users?.length || 0
      }
    })

  } catch (error) {
    console.error('GET /api/users 오류:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 새 사용자 생성
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { email, name } = body as Pick<User, 'email' | 'name'>

    // 입력 검증
    if (!email || !name) {
      return NextResponse.json(
        { error: 'email과 name은 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 존재하는 이메일입니다.' },
        { status: 409 }
      )
    }

    // 새 사용자 생성
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('사용자 생성 오류:', error)
      return NextResponse.json(
        { error: '사용자 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { user: newUser, message: '사용자가 성공적으로 생성되었습니다.' },
      { status: 201 }
    )

  } catch (error) {
    console.error('POST /api/users 오류:', error)
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
