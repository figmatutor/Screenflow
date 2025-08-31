'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];

export interface AuthUser extends User {
  profile?: UserProfile;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 현재 세션 확인
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // 사용자 프로필 정보 가져오기
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setUser({
          ...session.user,
          profile: profile || undefined
        });
      } else {
        setUser(null);
      }
      
      setLoading(false);
    };

    getSession();

    // Auth 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // 사용자 프로필 정보 가져오기
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          setUser({
            ...session.user,
            profile: profile || undefined
          });
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return { error: 'Supabase client not available' };
    
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
    }
    return { error };
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!supabase || !user) return { error: 'User not authenticated' };
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    
    if (!error && data) {
      setUser(prevUser => prevUser ? {
        ...prevUser,
        profile: data
      } : null);
    }
    
    return { data, error };
  };

  return {
    user,
    session,
    loading,
    signOut,
    updateProfile,
    isAuthenticated: !!session
  };
}
