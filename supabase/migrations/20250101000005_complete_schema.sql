-- ============================================================================
-- Screenflow 완전한 데이터베이스 스키마
-- 테이블 생성 + RLS 정책 + 인덱스 + 스토리지
-- UUID 타입 오류 완전 해결
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
    storage_limit BIGINT DEFAULT 1073741824 -- 1GB for free tier
);

-- USER_PREFERENCES 테이블
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    auto_archive BOOLEAN DEFAULT false,
    default_capture_type TEXT DEFAULT 'auto-flow' CHECK (default_capture_type IN ('auto-flow', 'smart-capture', 'interactive', 'capture-flow')),
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
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT,
    description TEXT,
    capture_type TEXT DEFAULT 'auto-flow' CHECK (capture_type IN ('auto-flow', 'smart-capture', 'interactive', 'capture-flow', 'auto-capture-zip')),
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
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    page_url TEXT NOT NULL,
    element_selector TEXT, -- CSS selector for clicked element
    element_description TEXT, -- Human readable description
    order_index INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    thumbnail_path TEXT, -- Small preview image path
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
    cover_image_path TEXT, -- Archive thumbnail
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
    category TEXT CHECK (category IN ('design', 'development', 'marketing', 'analytics', 'productivity', 'tools', 'inspiration')),
    relevance_score FLOAT CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    service_logo_url TEXT,
    pricing_model TEXT, -- free, freemium, paid, enterprise
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
-- 3. 기존 정책 삭제 (안전하게)
-- ============================================================================

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
-- 4. 안전한 RLS 정책 생성 (명시적 타입 캐스팅)
-- ============================================================================

-- Users 정책
CREATE POLICY "Users can view own profile" ON public.users 
FOR SELECT USING (auth.uid()::uuid = id::uuid);

CREATE POLICY "Users can update own profile" ON public.users 
FOR UPDATE USING (auth.uid()::uuid = id::uuid);

CREATE POLICY "Users can insert own profile" ON public.users 
FOR INSERT WITH CHECK (auth.uid()::uuid = id::uuid);

-- User preferences 정책
CREATE POLICY "Users can manage own preferences" ON public.user_preferences 
FOR ALL USING (auth.uid()::uuid = user_id::uuid);

-- Capture sessions 정책
CREATE POLICY "Users can manage own capture sessions" ON public.capture_sessions 
FOR ALL USING (auth.uid()::uuid = user_id::uuid);

-- Screenshots 정책
CREATE POLICY "Users can manage own screenshots" ON public.screenshots 
FOR ALL USING (auth.uid()::uuid = user_id::uuid);

-- Archives 정책
CREATE POLICY "Users can manage own archives" ON public.archives 
FOR ALL USING (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Anyone can view public archives" ON public.archives 
FOR SELECT USING (is_public = true);

-- Archive items 정책
CREATE POLICY "Users can manage archive items" ON public.archive_items 
FOR ALL USING (
    auth.uid()::uuid IN (
        SELECT user_id::uuid FROM public.archives WHERE id = archive_id
    )
);

-- Recommended services 정책
CREATE POLICY "Users can view recommendations for own sessions" ON public.recommended_services 
FOR SELECT USING (
    auth.uid()::uuid IN (
        SELECT user_id::uuid FROM public.capture_sessions WHERE id = session_id
    )
);

-- ============================================================================
-- 5. 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_capture_sessions_user_id ON public.capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_session_id ON public.capture_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_status ON public.capture_sessions(status);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_created_at ON public.capture_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_screenshots_session_id ON public.screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_is_archived ON public.screenshots(is_archived);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_archives_user_id ON public.archives(user_id);
CREATE INDEX IF NOT EXISTS idx_archives_is_public ON public.archives(is_public);
CREATE INDEX IF NOT EXISTS idx_archives_tags ON public.archives USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_archives_updated_at ON public.archives(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_archive_items_archive_id ON public.archive_items(archive_id);
CREATE INDEX IF NOT EXISTS idx_archive_items_screenshot_id ON public.archive_items(screenshot_id);

CREATE INDEX IF NOT EXISTS idx_recommended_services_session_id ON public.recommended_services(session_id);
CREATE INDEX IF NOT EXISTS idx_recommended_services_category ON public.recommended_services(category);
CREATE INDEX IF NOT EXISTS idx_recommended_services_relevance_score ON public.recommended_services(relevance_score DESC);

-- ============================================================================
-- 6. 업데이트 트리거 함수 및 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
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
-- 7. 스토리지 버킷 및 정책
-- ============================================================================

-- 스토리지 버킷 생성
DO $$
BEGIN
    -- screenshots 버킷
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'screenshots') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);
    END IF;
    
    -- thumbnails 버킷
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'thumbnails') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
    END IF;
    
    -- archives 버킷
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'archives') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('archives', 'archives', false);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Storage buckets may already exist or storage is not available';
END $$;

-- 스토리지 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;

-- 스토리지 정책 생성
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'screenshots' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view screenshots" ON storage.objects 
FOR SELECT USING (
    bucket_id = 'screenshots' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete screenshots" ON storage.objects 
FOR DELETE USING (
    bucket_id = 'screenshots' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Public can view thumbnails" ON storage.objects 
FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails' 
    AND auth.role() = 'authenticated'
);

-- ============================================================================
-- 8. 완료 알림
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Screenflow 완전한 데이터베이스 스키마 구성 완료!';
    RAISE NOTICE '📊 테이블: users, user_preferences, capture_sessions, screenshots, archives, archive_items, recommended_services';
    RAISE NOTICE '🔒 RLS 정책: 모든 테이블에 보안 정책 활성화 (UUID 타입 안전)';
    RAISE NOTICE '📁 스토리지: screenshots, thumbnails, archives 버킷 생성';
    RAISE NOTICE '⚡ 인덱스: 성능 최적화 인덱스 생성 완료';
    RAISE NOTICE '🔗 외래키: 모든 관계 설정 완료';
    RAISE NOTICE '🚀 서비스 배포 준비 완료!';
END $$;
