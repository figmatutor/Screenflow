import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cpaqhythcmolwbdlygen.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYXFoeXRoY21vbHdiZGx5Z2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMTQ5ODgsImV4cCI6MjA2OTY5MDk4OH0.CpvvvupytlpCPIZ9vBEnaimSn7Aww7bPehBOakvWPwQ'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYXFoeXRoY21vbHdiZGx5Z2VuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDExNDk4OCwiZXhwIjoyMDY5NjkwOTg4fQ.WBHyVT0A4NUlGWq-fJANVER97sm7trXKVDbkojnldgQ'

console.log('[Supabase Config] 환경변수 로드:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-anon-key',
  hasServiceKey: !!supabaseServiceRoleKey,
  isClient: typeof window !== 'undefined'
});

// 환경변수 검증 함수
function validateSupabaseConfig() {
  const hasUrl = supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co';
  const hasAnonKey = supabaseAnonKey && supabaseAnonKey !== 'placeholder-anon-key';
  
  if (!hasUrl || !hasAnonKey) {
    console.warn('[Supabase] 환경변수 검증 실패:', { hasUrl, hasAnonKey });
    return false;
  }
  
  console.log('[Supabase] 환경변수 검증 성공');
  return true;
}

// 클라이언트 생성 팩토리
function createSupabaseClient() {
  console.log('[Supabase] 클라이언트 생성 시작:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    anonKeyLength: supabaseAnonKey?.length,
    isClient: typeof window !== 'undefined'
  });
  
  // 환경변수 검증
  const isValid = validateSupabaseConfig();
  if (!isValid) {
    console.error('[Supabase] 환경변수 검증 실패 - 클라이언트 생성 중단');
    return null;
  }
  
  try {
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'X-Client-Info': 'screenflow-web'
        }
      }
    });
    
    console.log('[Supabase] 클라이언트 생성 완료');
    return client;
  } catch (error) {
    console.error('[Supabase] 클라이언트 생성 실패:', error);
    return null;
  }
}

function createSupabaseAdminClient() {
  const isConfigValid = validateSupabaseConfig()
  if (!isConfigValid && typeof window === 'undefined') {
    // 서버 사이드 빌드 중이고 환경변수가 없으면 플레이스홀더 반환
    return null
  }
  
  return createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// 클라이언트 사이드용 Supabase 클라이언트
export const supabase = createSupabaseClient()

// 서버 사이드용 Supabase 클라이언트 (Service Role Key 사용)
export const supabaseAdmin = createSupabaseAdminClient()

// Supabase 클라이언트 유틸리티 함수들
export const supabaseUtils = {
  // 현재 사용자 정보 가져오기
  getCurrentUser: async () => {
    if (!supabase) return null
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // 사용자 세션 확인
  getSession: async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // 로그아웃
  signOut: async () => {
    if (!supabase) return { error: 'Supabase client not available' }
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // 사용자 프로필 가져오기
  getUserProfile: async (userId: string) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
  },

  // 사용자 프로필 업데이트
  updateUserProfile: async (userId: string, updates: Database['public']['Tables']['users']['Update']) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
  },

  // 캡처 세션 생성
  createCaptureSession: async (sessionData: Database['public']['Tables']['capture_sessions']['Insert']) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('capture_sessions')
      .insert(sessionData)
      .select()
      .single()
  },

  // 캡처 세션 업데이트
  updateCaptureSession: async (sessionId: string, updates: Database['public']['Tables']['capture_sessions']['Update']) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('capture_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()
  },

  // 스크린샷 저장
  saveScreenshot: async (screenshotData: Database['public']['Tables']['screenshots']['Insert']) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('screenshots')
      .insert(screenshotData)
      .select()
      .single()
  },

  // 사용자별 캡처 세션 목록 가져오기
  getUserCaptureSessions: async (userId: string, limit = 20) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('capture_sessions')
      .select(`
        *,
        screenshots(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  // 아카이브 생성
  createArchive: async (archiveData: Database['public']['Tables']['archives']['Insert']) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('archives')
      .insert(archiveData)
      .select()
      .single()
  },

  // 사용자별 아카이브 목록
  getUserArchives: async (userId: string) => {
    if (!supabase) return { data: null, error: 'Supabase client not available' }
    return await supabase
      .from('archives')
      .select(`
        *,
        archive_items(count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
  }
}

// 타입 export
export type { Database }
export type SupabaseClient = ReturnType<typeof createSupabaseClient>