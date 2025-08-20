import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, User } from '@/lib/supabase'

// GET: 특정 사용자 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id } = await params

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      
      console.error('사용자 조회 오류:', error)
      return NextResponse.json(
        { error: '사용자 데이터를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('GET /api/users/[id] 오류:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { email, name } = body as Pick<User, 'email' | 'name'>

    // 입력 검증
    if (!email && !name) {
      return NextResponse.json(
        { error: '수정할 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    // 업데이트할 데이터 준비
    const updateData: Partial<User> = {
      updated_at: new Date().toISOString()
    }

    if (email) updateData.email = email
    if (name) updateData.name = name

    // 이메일 중복 확인 (다른 사용자와의 중복)
    if (email) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: '이미 사용 중인 이메일입니다.' },
          { status: 409 }
        )
      }
    }

    // 사용자 정보 업데이트
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      
      console.error('사용자 수정 오류:', error)
      return NextResponse.json(
        { error: '사용자 정보 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: updatedUser,
      message: '사용자 정보가 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('PUT /api/users/[id] 오류:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 사용자 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id } = await params

    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('사용자 삭제 오류:', error)
      return NextResponse.json(
        { error: '사용자 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: '사용자가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('DELETE /api/users/[id] 오류:', error)
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
