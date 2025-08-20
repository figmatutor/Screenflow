-- Supabase 스키마 생성 스크립트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.

-- 1. users 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. capture_sessions 테이블 생성
CREATE TABLE IF NOT EXISTS public.capture_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_user_id ON public.capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_session_id ON public.capture_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_status ON public.capture_sessions(status);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_created_at ON public.capture_sessions(created_at DESC);

-- 4. RLS (Row Level Security) 정책 설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (익명 사용자도 포함)
CREATE POLICY "Enable read access for all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.capture_sessions
    FOR SELECT USING (true);

-- 모든 사용자가 삽입 가능
CREATE POLICY "Enable insert for all users" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for all users" ON public.capture_sessions
    FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능
CREATE POLICY "Enable update for all users" ON public.users
    FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON public.capture_sessions
    FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능
CREATE POLICY "Enable delete for all users" ON public.users
    FOR DELETE USING (true);

CREATE POLICY "Enable delete for all users" ON public.capture_sessions
    FOR DELETE USING (true);

-- 5. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. updated_at 트리거 생성
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capture_sessions_updated_at 
    BEFORE UPDATE ON public.capture_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 샘플 데이터 삽입 (선택사항)
INSERT INTO public.users (email, name) VALUES 
    ('john@example.com', 'John Doe'),
    ('jane@example.com', 'Jane Smith'),
    ('admin@screenflow.pro', 'Admin User')
ON CONFLICT (email) DO NOTHING;

-- 완료 메시지
SELECT 'Supabase 스키마가 성공적으로 생성되었습니다!' as message;
