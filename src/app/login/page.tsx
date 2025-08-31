'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!supabase) {
        setError('로그인 서비스를 사용할 수 없습니다.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message === 'Invalid login credentials' 
          ? '이메일 또는 비밀번호가 올바르지 않습니다.' 
          : error.message);
        return;
      }

      // 로그인 성공 시 메인 페이지로 리다이렉트
      router.push('/');
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      setError('구글 로그인 중 오류가 발생했습니다.');
    }
  };

  const handleKakaoLogin = async () => {
    if (!supabase) {
      setError('로그인 서비스를 사용할 수 없습니다.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('카카오 로그인 오류:', error);
        setError('카카오 로그인 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('카카오 로그인 예외:', err);
      setError('카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      {/* 로고 및 타이틀 */}
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold mb-2">
            ScreenFlow유저분들
          </h1>
          <p className="text-white text-2xl font-bold mb-4">
            반갑습니다. 👋
          </p>
          <p className="text-white/60 text-sm mb-2">
            지금 바로 url을 입력하고,
          </p>
          <p className="text-white/60 text-sm">
            레퍼런스 고민에 드는 시간을 아껴보세요!
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 이메일 입력 */}
          <div>
            <label className="block text-white text-sm mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Example@email.com"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              required
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-white text-sm mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 최소 6자"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              required
            />
          </div>

          {/* 비밀번호 찾기 링크 */}
          <div className="text-right">
            <Link href="/forgot-password" className="text-blue-400 text-sm hover:text-blue-300">
              비밀번호를 잊어버리셨나요?
            </Link>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-600"></div>
          <span className="px-4 text-gray-400 text-sm">Or</span>
          <div className="flex-1 border-t border-gray-600"></div>
        </div>

        {/* 소셜 로그인 버튼들 */}
        <div className="space-y-3">
          {/* 구글 로그인 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            구글로 시작하기
          </button>

          {/* 카카오 로그인 */}
          <button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full py-3 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C7.03 3 3 6.14 3 10.1c0 2.52 1.65 4.77 4.15 6.08l-1.09 4.02c-.06.22.18.39.37.27l4.42-2.93c.38.04.77.06 1.15.06 4.97 0 9-3.14 9-7.1S16.97 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* 회원가입 링크 */}
        <div className="text-center mt-6">
          <span className="text-gray-400 text-sm">아직 계정이 없으신가요? </span>
          <Link href="/register" className="text-blue-400 text-sm hover:text-blue-300">
            가입하기
          </Link>
        </div>
      </div>
    </div>
  );
}
