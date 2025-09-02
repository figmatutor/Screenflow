-- ============================================================================
-- Capture Sessions RLS 정책 수정
-- 익명 사용자의 자동 캡처 세션 허용
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "sessions_select_own" ON public.capture_sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.capture_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.capture_sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.capture_sessions;

-- 새로운 정책: 로그인 사용자는 본인 세션만, 익명 사용자는 user_id가 NULL인 세션만
CREATE POLICY "sessions_select_policy" ON public.capture_sessions
    FOR SELECT USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

CREATE POLICY "sessions_insert_policy" ON public.capture_sessions
    FOR INSERT WITH CHECK (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

CREATE POLICY "sessions_update_policy" ON public.capture_sessions
    FOR UPDATE USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    ) WITH CHECK (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

CREATE POLICY "sessions_delete_policy" ON public.capture_sessions
    FOR DELETE USING (
        CASE 
            WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
            ELSE user_id IS NULL
        END
    );

-- 완료 메시지
SELECT 'Capture Sessions RLS 정책 수정 완료: 익명 사용자 지원' as message;
