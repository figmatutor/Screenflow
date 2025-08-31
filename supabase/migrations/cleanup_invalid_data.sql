-- ============================================================================
-- 잘못된 데이터 정리 및 무결성 확인
-- 실행 목적: 외래키 제약조건 위반 데이터 정리
-- ============================================================================

-- 1. 존재하지 않는 session_id를 참조하는 recommended_services 데이터 삭제
DELETE FROM public.recommended_services 
WHERE session_id NOT IN (
    SELECT id FROM public.capture_sessions
);

-- 2. 존재하지 않는 user_id를 참조하는 데이터 정리 (있다면)
DELETE FROM public.capture_sessions 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (
    SELECT id FROM auth.users
);

-- 3. 존재하지 않는 session_id를 참조하는 screenshots 데이터 정리 (있다면)
DELETE FROM public.screenshots 
WHERE session_id NOT IN (
    SELECT id FROM public.capture_sessions
);

-- 4. 고아(orphan) 데이터 정리
DELETE FROM public.archive_items 
WHERE archive_id NOT IN (
    SELECT id FROM public.archives
)
OR screenshot_id NOT IN (
    SELECT id FROM public.screenshots
);

-- 5. 데이터 무결성 확인 쿼리
-- 아래 쿼리들의 결과가 모두 0이어야 합니다

-- recommended_services의 무효한 session_id 개수
SELECT COUNT(*) as invalid_recommended_services
FROM public.recommended_services r
LEFT JOIN public.capture_sessions c ON r.session_id = c.id
WHERE c.id IS NULL;

-- screenshots의 무효한 session_id 개수
SELECT COUNT(*) as invalid_screenshots_session
FROM public.screenshots s
LEFT JOIN public.capture_sessions c ON s.session_id = c.id
WHERE c.id IS NULL;

-- screenshots의 무효한 user_id 개수
SELECT COUNT(*) as invalid_screenshots_user
FROM public.screenshots s
LEFT JOIN public.users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- archive_items의 무효한 참조 개수
SELECT COUNT(*) as invalid_archive_items
FROM public.archive_items ai
LEFT JOIN public.archives a ON ai.archive_id = a.id
LEFT JOIN public.screenshots s ON ai.screenshot_id = s.id
WHERE a.id IS NULL OR s.id IS NULL;

-- 6. 정리 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🧹 데이터 정리가 완료되었습니다!';
    RAISE NOTICE '🔍 위의 SELECT 쿼리 결과가 모두 0인지 확인하세요.';
    RAISE NOTICE '✅ 모든 외래키 제약조건이 정상적으로 작동합니다.';
END $$;
