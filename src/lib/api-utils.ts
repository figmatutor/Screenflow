import { NextResponse } from 'next/server'

// CORS 헤더 설정
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 성공 응답 생성 유틸리티
export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS
  })
}

// 에러 응답 생성 유틸리티
export function createErrorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: CORS_HEADERS
    }
  )
}

// OPTIONS 요청 처리 유틸리티
export function createOptionsResponse() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}

// 서버 에러 응답
export function createServerErrorResponse(error?: string) {
  return createErrorResponse(
    error || 'Internal server error',
    500
  )
}
