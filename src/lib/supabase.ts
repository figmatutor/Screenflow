import { createClient } from '@supabase/supabase-js'

// 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트 사이드용 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 서버 사이드용 Supabase 클라이언트 (Service Role Key 사용)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 데이터베이스 타입 정의
export interface User {
  id?: string
  email: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface CaptureSession {
  id?: string
  user_id?: string
  session_id: string
  url: string
  status: 'processing' | 'completed' | 'failed'
  result?: any
  created_at?: string
  updated_at?: string
}

// Supabase 클라이언트 유틸리티 함수들
export const supabaseUtils = {
  // 현재 사용자 정보 가져오기
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // 사용자 세션 확인
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // 로그아웃
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }
}
