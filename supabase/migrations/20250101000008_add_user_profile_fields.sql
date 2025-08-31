-- ============================================================================
-- 사용자 프로필 필드 추가 (생년월일, 주소)
-- ============================================================================

-- users 테이블에 birth와 address 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS birth DATE,
ADD COLUMN IF NOT EXISTS address TEXT;

-- 컬럼 설명 추가
COMMENT ON COLUMN public.users.birth IS '사용자 생년월일';
COMMENT ON COLUMN public.users.address IS '사용자 주소';

-- 완료 알림
DO $$
BEGIN
    RAISE NOTICE '✅ 사용자 테이블에 birth, address 컬럼 추가 완료!';
    RAISE NOTICE '📝 birth: DATE 타입 (생년월일)';
    RAISE NOTICE '📝 address: TEXT 타입 (주소)';
END $$;
