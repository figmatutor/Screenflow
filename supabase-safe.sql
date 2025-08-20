-- 안전한 Supabase 스키마 (트리거 중복 방지)

-- 1. 기존 트리거 삭제 (존재할 경우)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_capture_sessions_updated_at ON public.capture_sessions;

-- 2. 기존 함수 삭제 (존재할 경우)
DROP FUNCTION IF EXISTS update_updated_at_column();

-- 3. updated_at 자동 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 4. updated_at 트리거 생성
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capture_sessions_updated_at 
    BEFORE UPDATE ON public.capture_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
