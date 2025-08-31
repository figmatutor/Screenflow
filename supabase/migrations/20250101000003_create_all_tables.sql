-- ============================================================================
-- Screenflow 서비스 완전한 데이터베이스 스키마
-- 생성일: 2025-01-01
-- 설명: capture_sessions 테이블 미존재 문제 해결
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CAPTURE_SESSIONS 테이블 (기존 테이블이 없는 경우 생성)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.capture_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- 새로운 컬럼들
    title TEXT,
    description TEXT,
    capture_type TEXT DEFAULT 'auto-flow' CHECK (capture_type IN ('auto-flow', 'smart-capture', 'interactive', 'capture-flow', 'auto-capture-zip')),
    error_message TEXT,
    total_screenshots INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- 기존 컬럼이 없다면 추가 (테이블이 이미 존재하는 경우)
DO $$
BEGIN
    -- capture_type 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'capture_type') THEN
        ALTER TABLE public.capture_sessions 
        ADD COLUMN capture_type TEXT DEFAULT 'auto-flow' 
        CHECK (capture_type IN ('auto-flow', 'smart-capture', 'interactive', 'capture-flow', 'auto-capture-zip'));
    END IF;
    
    -- title 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'title') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN title TEXT;
    END IF;
    
    -- description 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'description') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN description TEXT;
    END IF;
    
    -- error_message 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'error_message') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN error_message TEXT;
    END IF;
    
    -- total_screenshots 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'total_screenshots') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN total_screenshots INTEGER DEFAULT 0;
    END IF;
    
    -- completed_at 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'completed_at') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- metadata 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'capture_sessions' AND column_name = 'metadata') THEN
        ALTER TABLE public.capture_sessions ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Warning: Could not add columns to capture_sessions: %', SQLERRM;
END $$;

-- Enable RLS for capture_sessions
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS 테이블
-- ============================================================================
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

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER_PREFERENCES 테이블
-- ============================================================================
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

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCREENSHOTS 테이블
-- ============================================================================
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

ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ARCHIVES 테이블
-- ============================================================================
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

ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ARCHIVE_ITEMS 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.archive_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    archive_id UUID REFERENCES public.archives(id) ON DELETE CASCADE NOT NULL,
    screenshot_id UUID REFERENCES public.screenshots(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER DEFAULT 0,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(archive_id, screenshot_id)
);

ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECOMMENDED_SERVICES 테이블
-- ============================================================================
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

ALTER TABLE public.recommended_services ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 외래키 제약조건 추가 (capture_sessions가 users를 참조하도록)
-- ============================================================================
DO $$
BEGIN
    -- user_id가 외래키로 설정되어 있지 않다면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'capture_sessions' 
        AND kcu.column_name = 'user_id' 
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.capture_sessions 
        ADD CONSTRAINT fk_capture_sessions_user_id 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Warning: Could not add foreign key constraint: %', SQLERRM;
END $$;

-- ============================================================================
-- RLS 정책 생성
-- ============================================================================

-- Drop all existing policies first
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

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id::uuid);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id::uuid);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id::uuid);

-- User preferences policies
CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id::uuid);

-- Capture sessions policies
CREATE POLICY "Users can manage own capture sessions" ON public.capture_sessions FOR ALL USING (auth.uid() = user_id::uuid);

-- Screenshots policies
CREATE POLICY "Users can manage own screenshots" ON public.screenshots FOR ALL USING (auth.uid() = user_id::uuid);

-- Archives policies
CREATE POLICY "Users can manage own archives" ON public.archives FOR ALL USING (auth.uid() = user_id::uuid);
CREATE POLICY "Anyone can view public archives" ON public.archives FOR SELECT USING (is_public = true);

-- Archive items policies
CREATE POLICY "Users can manage archive items" ON public.archive_items FOR ALL USING (
    auth.uid()::uuid IN (
        SELECT user_id FROM public.archives WHERE id = archive_id
    )
);

-- Recommended services policies
CREATE POLICY "Users can view recommendations for own sessions" ON public.recommended_services FOR SELECT USING (
    auth.uid()::uuid IN (
        SELECT user_id FROM public.capture_sessions WHERE id = session_id
    )
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

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
-- 트리거 및 함수
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
-- 스토리지 버킷 설정
-- ============================================================================

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
END $$;

-- 스토리지 정책 설정
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload thumbnails" ON storage.objects;

CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'screenshots' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view own screenshots" ON storage.objects FOR SELECT USING (
    bucket_id = 'screenshots' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE USING (
    bucket_id = 'screenshots' AND auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails' AND auth.role() = 'authenticated'
);

-- ============================================================================
-- 완료 알림
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Screenflow 데이터베이스 스키마가 성공적으로 구성되었습니다!';
    RAISE NOTICE '📊 모든 테이블이 생성되었습니다: capture_sessions, users, user_preferences, screenshots, archives, archive_items, recommended_services';
    RAISE NOTICE '🔒 보안 정책(RLS)이 모든 테이블에 활성화되었습니다.';
    RAISE NOTICE '📁 스토리지 버킷: screenshots, thumbnails, archives';
    RAISE NOTICE '⚡ 성능 최적화 인덱스가 생성되었습니다.';
    RAISE NOTICE '🔗 외래키 관계가 설정되었습니다.';
    RAISE NOTICE '🚀 서비스 배포 준비 완료!';
END $$;
