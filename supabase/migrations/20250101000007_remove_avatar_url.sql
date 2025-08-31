-- ============================================================================
-- Remove avatar_url column from users table
-- KOE205 에러 해결: 프로필 사진 수집 안함
-- ============================================================================

-- avatar_url 컬럼이 존재하는 경우에만 제거
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.users DROP COLUMN avatar_url;
        RAISE NOTICE 'avatar_url 컬럼이 제거되었습니다.';
    ELSE
        RAISE NOTICE 'avatar_url 컬럼이 이미 존재하지 않습니다.';
    END IF;
END $$;

-- 완료 메시지
SELECT 'KOE205 에러 해결: 프로필 사진 관련 컬럼 제거 완료' as message;
