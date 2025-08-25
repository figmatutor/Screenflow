'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AutoCaptureFlowOptions {
  maxLinks?: number;
  timeout?: number;
  scrollDelay?: number;
  scrollDistance?: number;
  waitUntil?: 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  viewportWidth?: number;
  viewportHeight?: number;
}

export default function AutoCaptureFlowPage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 옵션 상태
  const [options, setOptions] = useState<AutoCaptureFlowOptions>({
    maxLinks: 10,
    timeout: 30000,
    scrollDelay: 300,
    scrollDistance: 300,
    waitUntil: 'networkidle2',
    viewportWidth: 1440,
    viewportHeight: 900
  });

  const startAutoCaptureFlow = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Auto Capture Flow 요청 시작:', url, options);
      
      const response = await fetch('/api/auto-capture-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Auto Capture Flow 실패');
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `auto-capture-flow-${Date.now()}.zip`;
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
      
      setSuccess(`Auto Capture Flow가 성공적으로 완료되었습니다! 파일: ${filename}`);
      console.log('Auto Capture Flow 성공:', filename);
      
    } catch (err) {
      console.error('Auto Capture Flow 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🚀 Auto Capture Flow
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-gray-300 text-lg">
            스크롤링과 네트워크 안정성에 최적화된 자동 캡처 시스템
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Lazy-load 콘텐츠까지 완벽하게 캡처하는 고급 버전
          </p>
        </div>
        
        <Card className="bg-gray-900 border-gray-700 p-6 mb-8">
          <div className="space-y-6">
            {/* URL 입력 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                🌐 캡처할 웹사이트 URL
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* 기본 옵션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  🔗 최대 링크 수
                </label>
                <Input
                  type="number"
                  value={options.maxLinks}
                  onChange={(e) => setOptions({...options, maxLinks: parseInt(e.target.value) || 10})}
                  min="1"
                  max="50"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏱️ 페이지 타임아웃 (ms)
                </label>
                <Input
                  type="number"
                  value={options.timeout}
                  onChange={(e) => setOptions({...options, timeout: parseInt(e.target.value) || 30000})}
                  min="10000"
                  max="120000"
                  step="5000"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  📄 페이지 로딩 대기 방식
                </label>
                <Select 
                  value={options.waitUntil} 
                  onValueChange={(value: any) => setOptions({...options, waitUntil: value})}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="domcontentloaded">DOM 로드 완료</SelectItem>
                    <SelectItem value="networkidle0">네트워크 완전 정지</SelectItem>
                    <SelectItem value="networkidle2">네트워크 거의 정지 (권장)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 스크롤 옵션 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                📜 스크롤 옵션 (Lazy-load 최적화)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    📏 스크롤 거리 (px)
                  </label>
                  <Input
                    type="number"
                    value={options.scrollDistance}
                    onChange={(e) => setOptions({...options, scrollDistance: parseInt(e.target.value) || 300})}
                    min="100"
                    max="1000"
                    step="50"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">한 번에 스크롤할 픽셀 수</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    ⏳ 스크롤 지연 (ms)
                  </label>
                  <Input
                    type="number"
                    value={options.scrollDelay}
                    onChange={(e) => setOptions({...options, scrollDelay: parseInt(e.target.value) || 300})}
                    min="100"
                    max="2000"
                    step="100"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">스크롤 간격 시간</p>
                </div>
              </div>
            </div>

            {/* 뷰포트 옵션 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                🖥️ 뷰포트 설정
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    📐 너비 (px)
                  </label>
                  <Input
                    type="number"
                    value={options.viewportWidth}
                    onChange={(e) => setOptions({...options, viewportWidth: parseInt(e.target.value) || 1440})}
                    min="800"
                    max="2560"
                    step="20"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    📏 높이 (px)
                  </label>
                  <Input
                    type="number"
                    value={options.viewportHeight}
                    onChange={(e) => setOptions({...options, viewportHeight: parseInt(e.target.value) || 900})}
                    min="600"
                    max="1440"
                    step="20"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <p>💡 일반적인 해상도: 1440x900 (MacBook), 1920x1080 (Full HD), 1280x720 (HD)</p>
              </div>
            </div>
            
            <Button
              onClick={startAutoCaptureFlow}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-4"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  캡처 진행 중... (스크롤링 포함)
                </>
              ) : (
                <>🚀 Auto Capture Flow 시작</>
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
              🎯 주요 특징
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <strong className="text-white">📜 완전한 스크롤링:</strong> Lazy-load 콘텐츠까지 모든 요소 로딩
              </div>
              <div>
                <strong className="text-white">🌐 네트워크 안정성:</strong> networkidle2로 완전한 로딩 대기
              </div>
              <div>
                <strong className="text-white">🖥️ 고해상도 지원:</strong> 1440x900 기본, 사용자 정의 가능
              </div>
              <div>
                <strong className="text-white">🔄 순차 처리:</strong> 각 링크별 독립적인 페이지 인스턴스
              </div>
              <div>
                <strong className="text-white">🛡️ Bot Detection 방지:</strong> 실제 브라우저 환경 시뮬레이션
              </div>
              <div>
                <strong className="text-white">📁 자동 압축:</strong> 모든 스크린샷을 ZIP으로 패키징
              </div>
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              🔄 동작 원리
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                <span>메인 페이지 접속 및 완전한 스크롤링 수행</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                <span>모든 HTTP 링크 수집 및 중복 제거</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                <span>각 링크별 새 페이지 생성 및 로딩</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">4</span>
                <span>링크별 스크롤링 후 전체 페이지 캡처</span>
              </div>
              <div className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">5</span>
                <span>모든 스크린샷을 ZIP으로 압축하여 다운로드</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>🔗 API: POST /api/auto-capture-flow</p>
          <p>🌐 웹: http://localhost:3000/auto-capture-flow</p>
          <p className="mt-2 text-xs">원본 autoCaptureFlow 스크립트를 기반으로 한 프로덕션 레디 버전입니다.</p>
        </div>
      </div>
    </div>
  );
}
