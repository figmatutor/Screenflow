'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, data?: any) => Promise<{ error: Error | null }>;
  signInWithKakao: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 현재 세션 가져오기
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    };

    getSession();

    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase client not available') };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        console.log('[Auth] Login successful:', data.user.email);
        router.push('/');
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    if (!supabase) return { error: new Error('Supabase client not available') };

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });

      if (!error && data.user) {
        console.log('[Auth] Signup successful:', data.user.email);
        
        // users 테이블에 추가 정보 저장
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            display_name: userData?.display_name || null,
            birth: userData?.birth || null,
            address: userData?.address || null,
          });

        if (insertError) {
          console.error('[Auth] Profile creation error:', insertError);
          return { error: insertError };
        }

        router.push('/');
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signInWithKakao = async () => {
    if (!supabase) return { error: new Error('Supabase client not available') };

    try {
      console.log('[useAuth] Kakao OAuth 요청 시작');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'profile_nickname account_email'
        }
      });

      console.log('[useAuth] Kakao OAuth 응답:', { 
        data: !!data, 
        error: error?.message,
        url: data?.url 
      });

      return { error, data };
    } catch (err) {
      console.error('[useAuth] Kakao OAuth 예외:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    if (!supabase) return { error: new Error('Supabase client not available') };

    try {
      const { error } = await supabase.auth.signOut();
      
      if (!error) {
        console.log('[Auth] Logout successful');
        router.push('/login');
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const isAuthenticated = !!user && !!session;

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        loading, 
        isAuthenticated, 
        signIn, 
        signUp, 
        signInWithKakao,
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};