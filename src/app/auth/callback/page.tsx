'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!supabase) {
          setStatus('error');
          setMessage('인증 서비스를 사용할 수 없습니다.');
          return;
        }

        // URL에서 인증 정보 추출
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('인증 콜백 오류:', error);
          setStatus('error');
          setMessage('로그인 처리 중 오류가 발생했습니다.');
          
          // 3초 후 로그인 페이지로 리다이렉트
          setTimeout(() => {
            router.push('/login');
          }, 3000);
          return;
        }

        if (data.session) {
          console.log('로그인 성공:', data.session.user);
          setStatus('success');
          setMessage('로그인이 완료되었습니다. 메인 페이지로 이동합니다...');
          
          // 사용자 정보가 있는지 확인하고 필요시 users 테이블에 추가
          const user = data.session.user;
          if (user) {
            try {
              // 사용자 정보 처리 (카카오 로그인 포함)
              console.log('[Auth Callback] 사용자 정보:', {
                id: user.id,
                email: user.email,
                provider: user.app_metadata?.provider,
                user_metadata: user.user_metadata,
                identities: user.identities
              });

              const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

              if (userError && userError.code === 'PGRST116') {
                // 사용자가 존재하지 않으면 새로 생성
                const displayName = user.user_metadata?.full_name || 
                                  user.user_metadata?.name || 
                                  user.user_metadata?.nickname ||
                                  user.user_metadata?.preferred_username ||
                                  user.email?.split('@')[0] || 
                                  '카카오 사용자';

                console.log('[Auth Callback] 새 사용자 생성:', { 
                  displayName,
                  provider: user.app_metadata?.provider,
                  kakaoId: user.user_metadata?.sub || user.user_metadata?.provider_id
                });

                const { error: insertError } = await supabase
                  .from('users')
                  .insert([{
                    id: user.id,
                    email: user.email || '',
                    display_name: displayName,
                    birth: null,
                    address: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }]);

                if (insertError) {
                  console.error('[Auth Callback] 사용자 정보 저장 오류:', insertError);
                } else {
                  console.log('[Auth Callback] 사용자 정보 저장 완료');
                }
              } else if (existingUser) {
                console.log('[Auth Callback] 기존 사용자 로그인:', existingUser.display_name);
                
                // 기존 사용자의 정보 업데이트 (필요시)
                if (user.user_metadata?.nickname && existingUser.display_name !== user.user_metadata.nickname) {
                  const { error: updateError } = await supabase
                    .from('users')
                    .update({
                      display_name: user.user_metadata.nickname,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                  if (updateError) {
                    console.error('[Auth Callback] 사용자 정보 업데이트 오류:', updateError);
                  } else {
                    console.log('[Auth Callback] 사용자 정보 업데이트 완료');
                  }
                }
              }
            } catch (userProcessError) {
              console.error('사용자 정보 처리 오류:', userProcessError);
            }
          }
          
          // 1초 후 메인 페이지로 리다이렉트
          setTimeout(() => {
            router.push('/');
          }, 1000);
        } else {
          setStatus('error');
          setMessage('로그인 정보를 찾을 수 없습니다.');
          
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        }
      } catch (err) {
        console.error('인증 콜백 처리 오류:', err);
        setStatus('error');
        setMessage('로그인 처리 중 예상치 못한 오류가 발생했습니다.');
        
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          {status === 'loading' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          )}
          {status === 'success' && (
            <div className="text-green-400 text-4xl mb-4">✓</div>
          )}
          {status === 'error' && (
            <div className="text-red-400 text-4xl mb-4">✗</div>
          )}
        </div>
        
        <h1 className="text-white text-2xl font-bold mb-4">
          {status === 'loading' && '로그인 처리 중'}
          {status === 'success' && '로그인 성공!'}
          {status === 'error' && '로그인 실패'}
        </h1>
        
        <p className="text-white/60 text-sm">
          {message}
        </p>
        
        {status === 'error' && (
          <div className="mt-6">
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
            >
              로그인 페이지로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
