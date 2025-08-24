'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function TestScreenshotPage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureScreenshot = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setScreenshotUrl(null);

    try {
      console.log('스크린샷 캡처 요청 시작:', url);
      
      const response = await fetch('/api/test-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || '스크린샷 캡처 실패');
      }

      // 이미지 blob을 URL로 변환
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setScreenshotUrl(imageUrl);
      
      console.log('스크린샷 캡처 성공');
    } catch (err) {
      console.error('스크린샷 캡처 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Puppeteer 스크린샷 테스트
        </h1>
        
        <Card className="bg-gray-900 border-gray-700 p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                테스트할 URL
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            
            <Button
              onClick={captureScreenshot}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? '캡처 중...' : '스크린샷 캡처'}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="bg-red-900/20 border-red-500 p-4 mb-8">
            <h3 className="text-red-400 font-semibold mb-2">오류 발생</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
        )}

        {screenshotUrl && (
          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4">캡처된 스크린샷</h3>
            <div className="border border-gray-600 rounded-lg overflow-hidden">
              <img
                src={screenshotUrl}
                alt="캡처된 스크린샷"
                className="w-full h-auto"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = screenshotUrl;
                  link.download = `screenshot-${Date.now()}.png`;
                  link.click();
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                다운로드
              </Button>
              <Button
                onClick={() => {
                  URL.revokeObjectURL(screenshotUrl);
                  setScreenshotUrl(null);
                }}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                지우기
              </Button>
            </div>
          </Card>
        )}

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>이 페이지는 Puppeteer 스크린샷 기능을 테스트하기 위한 페이지입니다.</p>
          <p>로컬 환경에서는 시스템 Chrome을, Vercel에서는 @sparticuz/chromium을 사용합니다.</p>
        </div>
      </div>
    </div>
  );
}
