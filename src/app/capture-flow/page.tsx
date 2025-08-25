'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface CaptureFlowOptions {
  maxClicks?: number;
  timeout?: number;
  bufferTime?: number;
}

export default function CaptureFlowPage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 옵션 상태
  const [options, setOptions] = useState<CaptureFlowOptions>({
    maxClicks: 5,
    timeout: 15000,
    bufferTime: 1000
  });

  const startCaptureFlow = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Capture Flow 요청 시작:', url, options);
      
      const response = await fetch('/api/capture-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Capture Flow 실패');
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `capture-flow-${Date.now()}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // 자동 다운로드
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(downloadUrl);
      
      setSuccess(`Capture Flow가 성공적으로 완료되었습니다! 파일: ${filename}`);
      console.log('Capture Flow 성공:', filename);
      
    } catch (err) {
      console.error('Capture Flow 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🔄 Capture Flow
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-gray-300 text-lg">
            웹사이트의 메인 페이지와 내부 링크들을 순차적으로 캡처합니다
          </p>
          <p className="text-gray-400 text-sm mt-2">
            원본 스크립트를 기반으로 한 개선된 버전
          </p>
        </div>
        
        <Card className="bg-gray-900 border-gray-700 p-6 mb-8">
          <div className="space-y-6">
            {/* URL 입력 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                📌 캡처할 웹사이트 URL
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* 옵션 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  🔗 최대 링크 수
                </label>
                <Input
                  type="number"
                  value={options.maxClicks}
                  onChange={(e) => setOptions({...options, maxClicks: parseInt(e.target.value) || 5})}
                  min="1"
                  max="20"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">메인 페이지 외 캡처할 링크 수</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏱️ 페이지 타임아웃 (ms)
                </label>
                <Input
                  type="number"
                  value={options.timeout}
                  onChange={(e) => setOptions({...options, timeout: parseInt(e.target.value) || 15000})}
                  min="5000"
                  max="60000"
                  step="5000"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">각 페이지 로딩 최대 대기 시간</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏳ 버퍼 시간 (ms)
                </label>
                <Input
                  type="number"
                  value={options.bufferTime}
                  onChange={(e) => setOptions({...options, bufferTime: parseInt(e.target.value) || 1000})}
                  min="500"
                  max="5000"
                  step="500"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">페이지 로드 후 추가 대기</p>
              </div>
            </div>
            
            <Button
              onClick={startCaptureFlow}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  캡처 진행 중...
                </>
              ) : (
                <>🚀 Capture Flow 시작</>
              )}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="bg-red-900/20 border-red-500 p-4 mb-8">
            <h3 className="text-red-400 font-semibold mb-2">❌ 오류 발생</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
        )}

        {success && (
          <Card className="bg-green-900/20 border-green-500 p-4 mb-8">
            <h3 className="text-green-400 font-semibold mb-2">✅ 성공</h3>
            <p className="text-green-300 text-sm">{success}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              🎯 동작 방식
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                <span>메인 페이지 접속 및 스크린샷 촬영 (01-main.png)</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                <span>페이지 내 모든 하이퍼링크 수집 및 중복 제거</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                <span>각 링크를 순차적으로 방문하여 스크린샷 촬영</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">4</span>
                <span>모든 스크린샷을 ZIP 파일로 압축하여 다운로드</span>
              </div>
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              ⚡ 주요 특징
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <strong className="text-white">🛡️ Bot Detection 방지:</strong> 실제 브라우저 환경 시뮬레이션
              </div>
              <div>
                <strong className="text-white">🔄 순차 캡처:</strong> 링크별로 안정적인 순차 처리
              </div>
              <div>
                <strong className="text-white">📱 환경 최적화:</strong> 로컬/Vercel 환경 자동 감지
              </div>
              <div>
                <strong className="text-white">🏃‍♂️ 성능 최적화:</strong> headless: 'new' 사용
              </div>
              <div>
                <strong className="text-white">📁 자동 압축:</strong> ZIP 파일로 편리한 다운로드
              </div>
              <div>
                <strong className="text-white">🔍 오류 감지:</strong> 실패한 링크도 기록하여 추적
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>🔗 API: POST /api/capture-flow</p>
          <p>🌐 웹: http://localhost:3000/capture-flow</p>
          <p className="mt-2 text-xs">원본 스크립트의 간단함을 유지하면서 안정성과 기능을 향상시킨 버전입니다.</p>
        </div>
      </div>
    </div>
  );
}
