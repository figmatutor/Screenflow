'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface SmartCaptureOptions {
  maxClicks?: number;
  clickDelay?: number;
  waitTimeout?: number;
  viewport?: { width: number; height: number };
  selectors?: string[];
  captureFullPage?: boolean;
  skipDuplicates?: boolean;
  compressionLevel?: number;
}

const DEFAULT_SELECTORS = [
  'a[href]',
  'button', 
  '[role="button"]',
  '[onclick]',
  '[data-action]'
];

export default function SmartCapturePage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captureStats, setCaptureStats] = useState<{
    totalCaptures: number;
    duplicatesSkipped: number;
    totalClicks: number;
  } | null>(null);
  
  // 옵션 상태
  const [options, setOptions] = useState<SmartCaptureOptions>({
    maxClicks: 5,
    clickDelay: 150,
    waitTimeout: 2000,
    viewport: { width: 1280, height: 720 },
    selectors: DEFAULT_SELECTORS,
    captureFullPage: true,
    skipDuplicates: true,
    compressionLevel: 9
  });

  const [customSelectors, setCustomSelectors] = useState<string>(DEFAULT_SELECTORS.join('\n'));

  const startSmartCapture = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setCaptureStats(null);

    try {
      // 커스텀 선택자 파싱
      const parsedSelectors = customSelectors
        .split('\n')
        .map(s => s.trim())
        .filter(s => s);

      const requestOptions = {
        ...options,
        selectors: parsedSelectors
      };

      console.log('Smart Capture 요청 시작:', url, requestOptions);
      
      const response = await fetch('/api/smart-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options: requestOptions }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Smart Capture 실패');
      }

      // 응답 헤더에서 통계 정보 추출
      const totalCaptures = parseInt(response.headers.get('X-Total-Captures') || '0');
      const duplicatesSkipped = parseInt(response.headers.get('X-Duplicates-Skipped') || '0');
      const totalClicks = parseInt(response.headers.get('X-Total-Clicks') || '0');
      
      setCaptureStats({
        totalCaptures,
        duplicatesSkipped,
        totalClicks
      });

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `smart-capture-${Date.now()}.zip`;
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
      
      setSuccess(`Smart Capture가 성공적으로 완료되었습니다! 파일: ${filename}`);
      console.log('Smart Capture 성공:', filename);
      
    } catch (err) {
      console.error('Smart Capture 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🧠 Smart Capture
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-gray-300 text-lg">
            중복 제거와 해시 기반 유니크 캡처로 최적화된 스마트 캡처 시스템
          </p>
          <p className="text-gray-400 text-sm mt-2">
            SHA-1 해시 + MD5 요소 시그니처로 완벽한 중복 방지
          </p>
        </div>
        
        <Card className="bg-gray-900 border-gray-700 p-6 mb-8">
          <div className="space-y-6">
            {/* URL 입력 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                🌐 테스트할 웹사이트 URL
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  🖱️ 최대 클릭 수
                </label>
                <Input
                  type="number"
                  value={options.maxClicks}
                  onChange={(e) => setOptions({...options, maxClicks: parseInt(e.target.value) || 5})}
                  min="1"
                  max="50"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏱️ 클릭 지연 (ms)
                </label>
                <Input
                  type="number"
                  value={options.clickDelay}
                  onChange={(e) => setOptions({...options, clickDelay: parseInt(e.target.value) || 150})}
                  min="50"
                  max="1000"
                  step="50"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏳ 대기 시간 (ms)
                </label>
                <Input
                  type="number"
                  value={options.waitTimeout}
                  onChange={(e) => setOptions({...options, waitTimeout: parseInt(e.target.value) || 2000})}
                  min="500"
                  max="10000"
                  step="500"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* 스마트 옵션 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                🧠 스마트 캡처 옵션
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipDuplicates"
                    checked={options.skipDuplicates}
                    onCheckedChange={(checked) => setOptions({...options, skipDuplicates: !!checked})}
                  />
                  <label htmlFor="skipDuplicates" className="text-sm font-medium">
                    중복 스크린샷 자동 스킵 (SHA-1 해시 기반)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="captureFullPage"
                    checked={options.captureFullPage}
                    onCheckedChange={(checked) => setOptions({...options, captureFullPage: !!checked})}
                  />
                  <label htmlFor="captureFullPage" className="text-sm font-medium">
                    전체 페이지 캡처 (스크롤 영역 포함)
                  </label>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  📦 압축 레벨 (1-9)
                </label>
                <Input
                  type="range"
                  min="1"
                  max="9"
                  value={options.compressionLevel}
                  onChange={(e) => setOptions({...options, compressionLevel: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>빠름 (1)</span>
                  <span>현재: {options.compressionLevel}</span>
                  <span>최고 압축 (9)</span>
                </div>
              </div>
            </div>

            {/* 뷰포트 설정 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4">🖥️ 뷰포트 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">📐 너비 (px)</label>
                  <Input
                    type="number"
                    value={options.viewport?.width}
                    onChange={(e) => setOptions({
                      ...options, 
                      viewport: { ...options.viewport!, width: parseInt(e.target.value) || 1280 }
                    })}
                    min="800"
                    max="2560"
                    step="20"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">📏 높이 (px)</label>
                  <Input
                    type="number"
                    value={options.viewport?.height}
                    onChange={(e) => setOptions({
                      ...options, 
                      viewport: { ...options.viewport!, height: parseInt(e.target.value) || 720 }
                    })}
                    min="600"
                    max="1440"
                    step="20"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* CSS 선택자 설정 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4">🎯 클릭 대상 CSS 선택자</h3>
              <div>
                <label className="block text-sm font-medium mb-2">
                  선택자 목록 (한 줄에 하나씩)
                </label>
                <textarea
                  value={customSelectors}
                  onChange={(e) => setCustomSelectors(e.target.value)}
                  className="w-full h-24 bg-gray-800 border border-gray-600 text-white p-3 rounded text-sm font-mono"
                  placeholder="a[href]&#10;button&#10;[role=&quot;button&quot;]"
                />
              </div>
            </div>
            
            <Button
              onClick={startSmartCapture}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg py-4"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  스마트 캡처 진행 중...
                </>
              ) : (
                <>🧠 Smart Capture 시작</>
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
            
            {captureStats && (
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-800/30 rounded p-3">
                  <div className="text-2xl font-bold text-green-300">{captureStats.totalCaptures}</div>
                  <div className="text-xs text-green-400">유니크 캡처</div>
                </div>
                <div className="bg-yellow-800/30 rounded p-3">
                  <div className="text-2xl font-bold text-yellow-300">{captureStats.duplicatesSkipped}</div>
                  <div className="text-xs text-yellow-400">중복 스킵</div>
                </div>
                <div className="bg-blue-800/30 rounded p-3">
                  <div className="text-2xl font-bold text-blue-300">{captureStats.totalClicks}</div>
                  <div className="text-xs text-blue-400">총 클릭</div>
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              🧠 스마트 기능
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <strong className="text-white">🔍 SHA-1 해시 중복 감지:</strong> 픽셀 단위로 동일한 스크린샷 자동 스킵
              </div>
              <div>
                <strong className="text-white">🏷️ MD5 요소 시그니처:</strong> 이미 클릭한 요소 재클릭 방지
              </div>
              <div>
                <strong className="text-white">📊 실시간 통계:</strong> 유니크/중복/클릭 수 실시간 추적
              </div>
              <div>
                <strong className="text-white">📁 메타데이터 포함:</strong> 세션 정보와 상세 로그 ZIP에 포함
              </div>
              <div>
                <strong className="text-white">⚡ 효율성 최적화:</strong> 불필요한 캡처 최소화로 성능 향상
              </div>
              <div>
                <strong className="text-white">🎯 정밀 타겟팅:</strong> 요소 가시성 검증 및 상세 정보 수집
              </div>
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              🔄 동작 원리
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                <span>초기 페이지 캡처 및 SHA-1 해시 생성</span>
              </div>
              <div className="flex items-start">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                <span>요소별 MD5 시그니처 생성 및 중복 클릭 방지</span>
              </div>
              <div className="flex items-start">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                <span>클릭 후 스크린샷 해시 비교로 중복 감지</span>
              </div>
              <div className="flex items-start">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">4</span>
                <span>유니크 스크린샷만 ZIP에 저장</span>
              </div>
              <div className="flex items-start">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">5</span>
                <span>상세 메타데이터와 통계 정보 생성</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>🔗 API: POST /api/smart-capture</p>
          <p>🌐 웹: http://localhost:3000/smart-capture</p>
          <p className="mt-2 text-xs">
            원본 중복 제거 스크립트를 기반으로 한 지능형 캡처 시스템입니다.<br/>
            SHA-1 해시와 MD5 시그니처로 완벽한 중복 방지를 제공합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
