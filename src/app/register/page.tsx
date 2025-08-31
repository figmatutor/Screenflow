'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    birth: '',
    address: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }
    if (!formData.birth) {
      setError('생년월일을 입력해주세요.');
      return false;
    }
    if (!formData.address.trim()) {
      setError('주소를 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (!supabase) {
        setError('회원가입 서비스를 사용할 수 없습니다.');
        return;
      }

      // 1. Supabase Auth로 사용자 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        setError(authError.message === 'User already registered' 
          ? '이미 등록된 이메일입니다.' 
          : authError.message);
        return;
      }

      if (!authData.user) {
        setError('회원가입 중 오류가 발생했습니다.');
        return;
      }

      // 2. users 테이블에 추가 정보 저장
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          birth: formData.birth,
          address: formData.address,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // 프로필 생성 실패해도 회원가입은 성공한 상태이므로 로그인 페이지로 이동
      }

      // 회원가입 성공 시 로그인 페이지로 리다이렉트
      router.push('/login?message=회원가입이 완료되었습니다. 로그인해주세요.');
    } catch (err) {
      console.error('Registration error:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!supabase) return;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/complete-profile`
      }
    });

    if (error) {
      setError('구글 회원가입 중 오류가 발생했습니다.');
    }
  };

  const handleKakaoRegister = async () => {
    if (!supabase) {
      setError('회원가입 서비스를 사용할 수 없습니다.');
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
        console.error('카카오 회원가입 오류:', error);
        setError('카카오 회원가입 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('카카오 회원가입 예외:', err);
      setError('카카오 회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      {/* 회원가입 폼 */}
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

        {/* 회원가입 폼 */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* 이메일 입력 */}
          <div>
            <label className="block text-white text-sm mb-2">
              이메일
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
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
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="비밀번호 최소 6자"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              required
            />
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-white text-sm mb-2">
              비밀번호 확인
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="비밀번호 다시 입력"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              required
            />
          </div>

          {/* 생년월일 입력 */}
          <div>
            <label className="block text-white text-sm mb-2">
              생년월일
            </label>
            <input
              type="date"
              name="birth"
              value={formData.birth}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* 주소 입력 */}
          <div>
            <label className="block text-white text-sm mb-2">
              주소
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="주소를 입력해주세요"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              required
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-600"></div>
          <span className="px-4 text-gray-400 text-sm">Or sign up with</span>
          <div className="flex-1 border-t border-gray-600"></div>
        </div>

        {/* 소셜 회원가입 버튼들 */}
        <div className="space-y-3">
          {/* 구글 회원가입 */}
          <button
            onClick={handleGoogleRegister}
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

          {/* 카카오 회원가입 */}
          <button
            onClick={handleKakaoRegister}
            disabled={isLoading}
            className="w-full py-3 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C7.03 3 3 6.14 3 10.1c0 2.52 1.65 4.77 4.15 6.08l-1.09 4.02c-.06.22.18.39.37.27l4.42-2.93c.38.04.77.06 1.15.06 4.97 0 9-3.14 9-7.1S16.97 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* 로그인 링크 */}
        <div className="text-center mt-6">
          <span className="text-gray-400 text-sm">이미 계정이 있으신가요? </span>
          <Link href="/login" className="text-blue-400 text-sm hover:text-blue-300">
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}
