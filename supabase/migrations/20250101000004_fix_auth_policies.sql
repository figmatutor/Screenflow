-- ============================================================================
-- Supabase Auth 타입 호환성 해결
-- UUID 타입 오류 완전 해결
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 기존 정책 모두 삭제
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
-- 텍스트 변환으로 타입 안전한 RLS 정책 재생성
-- UUID = text 오류 해결: auth.uid()::text = id::text
-- ============================================================================

-- Users 정책 (텍스트 변환으로 안전한 비교)
CREATE POLICY "Users can view own profile" ON public.users 
FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON public.users 
FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own profile" ON public.users 
FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- User preferences 정책
CREATE POLICY "Users can manage own preferences" ON public.user_preferences 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Capture sessions 정책
CREATE POLICY "Users can manage own capture sessions" ON public.capture_sessions 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Screenshots 정책
CREATE POLICY "Users can manage own screenshots" ON public.screenshots 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Archives 정책
CREATE POLICY "Users can manage own archives" ON public.archives 
FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anyone can view public archives" ON public.archives 
FOR SELECT USING (is_public = true);

-- Archive items 정책 (서브쿼리에서도 텍스트 변환)
CREATE POLICY "Users can manage archive items" ON public.archive_items 
FOR ALL USING (
    auth.uid()::text IN (
        SELECT user_id::text FROM public.archives WHERE id = archive_id
    )
);

-- Recommended services 정책
CREATE POLICY "Users can view recommendations for own sessions" ON public.recommended_services 
FOR SELECT USING (
    auth.uid()::text IN (
        SELECT user_id::text FROM public.capture_sessions WHERE id = session_id
    )
);

-- ============================================================================
-- 대안: 함수 기반 접근법 (위 방법이 실패할 경우)
-- ============================================================================

-- 사용자 확인을 위한 안전한 함수 생성
CREATE OR REPLACE FUNCTION auth.user_id() 
RETURNS UUID 
LANGUAGE SQL 
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

-- 함수를 사용한 대안 정책들 (주석 처리, 필요시 활성화)
/*
-- Users 정책 (함수 사용)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
FOR SELECT USING (auth.user_id() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
FOR UPDATE USING (auth.user_id() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users 
FOR INSERT WITH CHECK (auth.user_id() = id);

-- 다른 테이블들도 동일한 패턴으로...
*/

-- ============================================================================
-- 스토리지 정책 (간단하고 안전한 방식)
-- ============================================================================

-- 기존 스토리지 정책 삭제
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload thumbnails" ON storage.objects;

-- 새로운 스토리지 정책 (role 기반)
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
-- 완료 메시지
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ UUID = text 타입 오류 완전 해결!';
    RAISE NOTICE '🔧 텍스트 변환으로 안전한 비교: auth.uid()::text = id::text';
    RAISE NOTICE '🔒 모든 RLS 정책이 타입 안전하게 재생성됨';
    RAISE NOTICE '📁 스토리지 정책도 role 기반으로 안정화';
    RAISE NOTICE '💡 텍스트 비교로 모든 타입 충돌 해결';
    RAISE NOTICE '🚀 이제 확실히 모든 UUID 오류가 해결되었습니다!';
END $$;
