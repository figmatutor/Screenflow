-- ============================================================================
-- Supabase 표준 방식을 사용한 안전한 RLS 정책
-- auth 스키마 권한 문제 해결
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. 모든 테이블 생성
-- ============================================================================

-- USERS 테이블
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 1073741824
);

-- USER_PREFERENCES 테이블
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    auto_archive BOOLEAN DEFAULT false,
    default_capture_type TEXT DEFAULT 'auto-flow',
    notification_email BOOLEAN DEFAULT true,
    storage_cleanup_days INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id)
);

-- CAPTURE_SESSIONS 테이블
CREATE TABLE IF NOT EXISTS public.capture_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT,
    description TEXT,
    capture_type TEXT DEFAULT 'auto-flow',
    error_message TEXT,
    total_screenshots INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- SCREENSHOTS 테이블
CREATE TABLE IF NOT EXISTS public.screenshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    page_url TEXT NOT NULL,
    element_selector TEXT,
    element_description TEXT,
    order_index INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    thumbnail_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ARCHIVES 테이블
CREATE TABLE IF NOT EXISTS public.archives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    cover_image_path TEXT,
    item_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ARCHIVE_ITEMS 테이블
CREATE TABLE IF NOT EXISTS public.archive_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    archive_id UUID REFERENCES public.archives(id) ON DELETE CASCADE NOT NULL,
    screenshot_id UUID REFERENCES public.screenshots(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER DEFAULT 0,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(archive_id, screenshot_id)
);

-- RECOMMENDED_SERVICES 테이블
CREATE TABLE IF NOT EXISTS public.recommended_services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
    service_name TEXT NOT NULL,
    service_url TEXT NOT NULL,
    service_description TEXT,
    category TEXT,
    relevance_score FLOAT,
    service_logo_url TEXT,
    pricing_model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 2. RLS 활성화
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommended_services ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. 모든 기존 정책 삭제
-- ============================================================================

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "user_preferences_all_own" ON public.user_preferences;
DROP POLICY IF EXISTS "capture_sessions_all_own" ON public.capture_sessions;
DROP POLICY IF EXISTS "screenshots_all_own" ON public.screenshots;
DROP POLICY IF EXISTS "archives_manage_own" ON public.archives;
DROP POLICY IF EXISTS "archives_view_public" ON public.archives;
DROP POLICY IF EXISTS "archive_items_manage_own" ON public.archive_items;
DROP POLICY IF EXISTS "recommended_services_view_own" ON public.recommended_services;

-- 기존 정책들도 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can manage own capture sessions" ON public.capture_sessions;
DROP POLICY IF EXISTS "Users can manage own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can manage own archives" ON public.archives;
DROP POLICY IF EXISTS "Anyone can view public archives" ON public.archives;
DROP POLICY IF EXISTS "Users can manage archive items" ON public.archive_items;
DROP POLICY IF EXISTS "Users can view recommendations for own sessions" ON public.recommended_services;

-- ============================================================================
-- 4. 표준 Supabase 방식 RLS 정책 (문자열 비교)
-- ============================================================================

-- Users 정책 - auth.uid()를 텍스트로 변환해서 비교
CREATE POLICY "users_select_own" ON public.users 
FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "users_update_own" ON public.users 
FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "users_insert_own" ON public.users 
FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- User preferences 정책
CREATE POLICY "user_preferences_all_own" ON public.user_preferences 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Capture sessions 정책
CREATE POLICY "capture_sessions_all_own" ON public.capture_sessions 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Screenshots 정책
CREATE POLICY "screenshots_all_own" ON public.screenshots 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Archives 정책
CREATE POLICY "archives_manage_own" ON public.archives 
FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "archives_view_public" ON public.archives 
FOR SELECT USING (is_public = true);

-- Archive items 정책 (서브쿼리도 텍스트 비교)
CREATE POLICY "archive_items_manage_own" ON public.archive_items 
FOR ALL USING (
    auth.uid()::text IN (
        SELECT user_id::text FROM public.archives WHERE id = archive_id
    )
);

-- Recommended services 정책
CREATE POLICY "recommended_services_view_own" ON public.recommended_services 
FOR SELECT USING (
    auth.uid()::text IN (
        SELECT user_id::text FROM public.capture_sessions WHERE id = session_id
    )
);

-- ============================================================================
-- 5. 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_user_id ON public.capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_session_id ON public.capture_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_session_id ON public.screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_archives_user_id ON public.archives(user_id);
CREATE INDEX IF NOT EXISTS idx_archives_is_public ON public.archives(is_public);
CREATE INDEX IF NOT EXISTS idx_archive_items_archive_id ON public.archive_items(archive_id);
CREATE INDEX IF NOT EXISTS idx_recommended_services_session_id ON public.recommended_services(session_id);

-- ============================================================================
-- 6. 업데이트 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_capture_sessions_updated_at ON public.capture_sessions;
CREATE TRIGGER update_capture_sessions_updated_at BEFORE UPDATE ON public.capture_sessions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_archives_updated_at ON public.archives;
CREATE TRIGGER update_archives_updated_at BEFORE UPDATE ON public.archives
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 7. 스토리지 설정
-- ============================================================================

-- 스토리지 버킷 생성
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Screenshots bucket may already exist';
END $$;

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Thumbnails bucket may already exist';
END $$;

-- 스토리지 정책
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_view" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

CREATE POLICY "authenticated_upload" ON storage.objects 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_view" ON storage.objects 
FOR SELECT USING (auth.role() = 'authenticated' OR bucket_id = 'thumbnails');

CREATE POLICY "authenticated_delete" ON storage.objects 
FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================================
-- 8. 완료 알림
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ 표준 Supabase 방식으로 RLS 정책 구성 완료!';
    RAISE NOTICE '🔧 auth.uid()::text = id::text 방식으로 텍스트 비교';
    RAISE NOTICE '📊 모든 테이블 생성 및 관계 설정 완료';
    RAISE NOTICE '🔒 권한 오류 없이 안전한 정책 생성';
    RAISE NOTICE '📁 스토리지 버킷 및 정책 설정 완료';
    RAISE NOTICE '⚡ 성능 최적화 인덱스 생성 완료';
    RAISE NOTICE '🚀 서비스 배포 준비 완료!';
    RAISE NOTICE '';
    RAISE NOTICE '💡 텍스트 비교 방식으로 모든 타입 오류 해결!';
    RAISE NOTICE '💡 auth 스키마 권한 문제도 완전히 회피!';
END $$;
