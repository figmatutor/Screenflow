-- ============================================================================
-- Screenflow 서비스 데이터베이스 스키마
-- 생성일: 2025-01-01
-- 설명: 웹 스크린샷 캡처, 아카이빙, 서비스 추천 기능을 위한 테이블 구조
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS 테이블 (Supabase Auth와 연동)
-- ============================================================================
CREATE TABLE public.users (
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

-- Enable RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. USER_PREFERENCES 테이블 (사용자 설정)
-- ============================================================================
CREATE TABLE public.user_preferences (
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
CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. CAPTURE_SESSIONS 테이블 (캡처 세션 관리)
-- ============================================================================
CREATE TABLE public.capture_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    capture_type TEXT NOT NULL CHECK (capture_type IN ('auto-flow', 'smart-capture', 'interactive', 'capture-flow', 'auto-capture-zip')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    total_screenshots INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own capture sessions" ON public.capture_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SCREENSHOTS 테이블 (개별 스크린샷 관리)
-- ============================================================================
CREATE TABLE public.screenshots (
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
CREATE POLICY "Users can manage own screenshots" ON public.screenshots FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. ARCHIVES 테이블 (사용자 아카이브 컬렉션)
-- ============================================================================
CREATE TABLE public.archives (
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
CREATE POLICY "Users can manage own archives" ON public.archives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view public archives" ON public.archives FOR SELECT USING (is_public = true);

-- ============================================================================
-- 6. ARCHIVE_ITEMS 테이블 (아카이브 내 아이템들)
-- ============================================================================
CREATE TABLE public.archive_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    archive_id UUID REFERENCES public.archives(id) ON DELETE CASCADE NOT NULL,
    screenshot_id UUID REFERENCES public.screenshots(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER DEFAULT 0,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(archive_id, screenshot_id)
);

ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage archive items" ON public.archive_items FOR ALL USING (
    auth.uid() IN (
        SELECT user_id FROM public.archives WHERE id = archive_id
    )
);

-- ============================================================================
-- 7. RECOMMENDED_SERVICES 테이블 (AI 추천 서비스)
-- ============================================================================
CREATE TABLE public.recommended_services (
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
CREATE POLICY "Users can view recommendations for own sessions" ON public.recommended_services FOR SELECT USING (
    auth.uid() IN (
        SELECT user_id FROM public.capture_sessions WHERE id = session_id
    )
);

-- ============================================================================
-- 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 자주 조회되는 컬럼들에 인덱스 생성
CREATE INDEX idx_capture_sessions_user_id ON public.capture_sessions(user_id);
CREATE INDEX idx_capture_sessions_status ON public.capture_sessions(status);
CREATE INDEX idx_capture_sessions_created_at ON public.capture_sessions(created_at DESC);

CREATE INDEX idx_screenshots_session_id ON public.screenshots(session_id);
CREATE INDEX idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX idx_screenshots_is_archived ON public.screenshots(is_archived);
CREATE INDEX idx_screenshots_created_at ON public.screenshots(created_at DESC);

CREATE INDEX idx_archives_user_id ON public.archives(user_id);
CREATE INDEX idx_archives_is_public ON public.archives(is_public);
CREATE INDEX idx_archives_tags ON public.archives USING GIN(tags);
CREATE INDEX idx_archives_updated_at ON public.archives(updated_at DESC);

CREATE INDEX idx_archive_items_archive_id ON public.archive_items(archive_id);
CREATE INDEX idx_archive_items_screenshot_id ON public.archive_items(screenshot_id);

CREATE INDEX idx_recommended_services_session_id ON public.recommended_services(session_id);
CREATE INDEX idx_recommended_services_category ON public.recommended_services(category);
CREATE INDEX idx_recommended_services_relevance_score ON public.recommended_services(relevance_score DESC);

-- ============================================================================
-- 트리거 함수 생성 (자동 업데이트)
-- ============================================================================

-- Updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_archives_updated_at BEFORE UPDATE ON public.archives
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 스토리지 버킷 생성 (Supabase Storage)
-- ============================================================================

-- 스크린샷 파일용 버킷
INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('archives', 'archives', false);

-- 스토리지 정책 설정
CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own screenshots" ON storage.objects FOR SELECT USING (
    bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE USING (
    bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 썸네일은 누구나 볼 수 있도록 설정
CREATE POLICY "Anyone can view thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Users can upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- 샘플 데이터 삽입 (개발용 - 선택사항)
-- ============================================================================

-- 샘플 추천 서비스 카테고리 데이터
INSERT INTO public.recommended_services (session_id, service_name, service_url, service_description, category, relevance_score, pricing_model) VALUES
    ('00000000-0000-0000-0000-000000000000', 'Figma', 'https://figma.com', '협업 기반 UI/UX 디자인 도구', 'design', 0.95, 'freemium'),
    ('00000000-0000-0000-0000-000000000000', 'Dribbble', 'https://dribbble.com', '디자인 영감과 포트폴리오 공유', 'inspiration', 0.90, 'freemium'),
    ('00000000-0000-0000-0000-000000000000', 'GitHub', 'https://github.com', '개발 협업 및 코드 호스팅', 'development', 0.92, 'freemium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 완료 메시지
-- ============================================================================

-- 마이그레이션 완료 확인
DO $$
BEGIN
    RAISE NOTICE '🎉 Screenflow 데이터베이스 마이그레이션이 성공적으로 완료되었습니다!';
    RAISE NOTICE '📊 생성된 테이블: users, user_preferences, capture_sessions, screenshots, archives, archive_items, recommended_services';
    RAISE NOTICE '🔒 RLS (Row Level Security) 정책이 모든 테이블에 적용되었습니다.';
    RAISE NOTICE '📁 스토리지 버킷: screenshots, thumbnails, archives가 생성되었습니다.';
    RAISE NOTICE '⚡ 성능 최적화를 위한 인덱스가 생성되었습니다.';
END $$;
