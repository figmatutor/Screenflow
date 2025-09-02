-- ============================================================================
-- Add avatar_url column back to users table
-- KOE205 해결: 프로필 이미지 수집 활성화
-- ============================================================================

-- avatar_url 컬럼이 존재하지 않는 경우에만 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    RAISE NOTICE 'avatar_url 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'avatar_url 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- 완료 메시지
SELECT 'KOE205 해결: 프로필 이미지 수집을 위한 avatar_url 컬럼 추가 완료' as message;
