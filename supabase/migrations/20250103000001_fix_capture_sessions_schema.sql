-- 🔧 capture_sessions 테이블 스키마 수정
-- ERR: "Could not find the 'id' column of 'capture_sessions'" 해결

-- 기존 테이블이 있다면 삭제 후 재생성
DROP TABLE IF EXISTS public.capture_sessions CASCADE;

-- capture_sessions 테이블 생성 (올바른 스키마)
CREATE TABLE public.capture_sessions (
    id TEXT PRIMARY KEY,                    -- 세션 ID (문자열)
    status TEXT NOT NULL DEFAULT 'pending', -- 상태: pending, processing, completed, failed
    url TEXT,                              -- 캡처 대상 URL
    result JSONB,                          -- 캡처 결과 (JSON)
    error TEXT,                            -- 오류 메시지
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 사용자 ID (nullable for anonymous)
    created_at TIMESTAMPTZ DEFAULT NOW(),  -- 생성 시간
    updated_at TIMESTAMPTZ DEFAULT NOW(),  -- 업데이트 시간
    
    -- 인덱스
    CONSTRAINT capture_sessions_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- 인덱스 생성
CREATE INDEX idx_capture_sessions_user_id ON public.capture_sessions(user_id);
CREATE INDEX idx_capture_sessions_status ON public.capture_sessions(status);
CREATE INDEX idx_capture_sessions_created_at ON public.capture_sessions(created_at);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
-- 1. SELECT: 자신의 세션 또는 익명 세션 조회 가능
CREATE POLICY "sessions_select_policy" ON public.capture_sessions
    FOR SELECT USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL  -- 익명 사용자는 user_id가 NULL인 세션만 조회
        END
    );

-- 2. INSERT: 자신의 세션 또는 익명 세션 생성 가능
CREATE POLICY "sessions_insert_policy" ON public.capture_sessions
    FOR INSERT WITH CHECK (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL  -- 익명 사용자는 user_id를 NULL로 설정
        END
    );

-- 3. UPDATE: 자신의 세션 또는 익명 세션 업데이트 가능
CREATE POLICY "sessions_update_policy" ON public.capture_sessions
    FOR UPDATE USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    ) WITH CHECK (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

-- 4. DELETE: 자신의 세션 또는 익명 세션 삭제 가능
CREATE POLICY "sessions_delete_policy" ON public.capture_sessions
    FOR DELETE USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_capture_sessions_updated_at 
    BEFORE UPDATE ON public.capture_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- 테이블 생성 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'capture_sessions' 
    AND table_schema = 'public'
ORDER BY ordinal_position;
