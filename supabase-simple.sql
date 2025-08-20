-- 간단한 Supabase 스키마 (문제 해결용)

CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.capture_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    session_id TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 인덱스
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_capture_sessions_session_id ON public.capture_sessions(session_id);

-- 샘플 데이터
INSERT INTO public.users (email, name) VALUES 
    ('test@example.com', 'Test User');
