-- ============================================================================
-- 기존 Supabase 스키마 확인용 SQL
-- 실행 전에 이 쿼리로 현재 테이블 구조를 확인하세요
-- ============================================================================

-- 1. 현재 존재하는 테이블 목록 확인
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. capture_sessions 테이블 구조 확인 (존재하는 경우)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'capture_sessions'
ORDER BY ordinal_position;

-- 3. 모든 public 테이블의 컬럼 정보
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4. 외래키 제약조건 확인
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public';

-- 5. RLS (Row Level Security) 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    hasrls
FROM pg_tables 
WHERE schemaname = 'public';

-- 6. 기존 정책(Policy) 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public';

-- 7. 스토리지 버킷 확인
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
ORDER BY created_at;

-- 8. 스토리지 정책 확인
SELECT 
    policyname,
    bucket_id,
    operation,
    definition
FROM storage.policies
ORDER BY bucket_id, operation;
