'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface InteractiveCaptureOptions {
  maxClicks?: number;
  clickDelay?: number;
  waitTimeout?: number;
  viewport?: { width: number; height: number };
  selectors?: string[];
  captureFullPage?: boolean;
}

const DEFAULT_SELECTORS = [
  'a[href]',
  'button', 
  '[role="button"]',
  '[onclick]',
  '[data-action]'
];

export default function InteractiveCapturePage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 옵션 상태
  const [options, setOptions] = useState<InteractiveCaptureOptions>({
    maxClicks: 5,
    clickDelay: 150,
    waitTimeout: 2000,
    viewport: { width: 1280, height: 720 },
    selectors: DEFAULT_SELECTORS,
    captureFullPage: true
  });

  const [customSelectors, setCustomSelectors] = useState<string>(DEFAULT_SELECTORS.join('\n'));

  const startInteractiveCapture = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

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

      console.log('Interactive Capture 요청 시작:', url, requestOptions);
      
      const response = await fetch('/api/interactive-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options: requestOptions }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Interactive Capture 실패');
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `interactive-capture-${Date.now()}.zip`;
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
      
      setSuccess(`Interactive Capture가 성공적으로 완료되었습니다! 파일: ${filename}`);
      console.log('Interactive Capture 성공:', filename);
      
    } catch (err) {
      console.error('Interactive Capture 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🎯 Interactive Capture
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-gray-300 text-lg">
            클릭 가능한 요소들과 상호작용하며 각 단계를 캡처합니다
          </p>
          <p className="text-gray-400 text-sm mt-2">
            버튼, 링크, 클릭 요소들의 반응을 순차적으로 기록
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
                  max="20"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">각 선택자별 최대 클릭 횟수</p>
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
                <p className="text-xs text-gray-400 mt-1">클릭 동작의 지연 시간</p>
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
                <p className="text-xs text-gray-400 mt-1">클릭 후 페이지 반응 대기</p>
              </div>
            </div>

            {/* 뷰포트 설정 */}
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
                  <label className="block text-sm font-medium mb-2">
                    📏 높이 (px)
                  </label>
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

            {/* 캡처 옵션 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4">📸 캡처 옵션</h3>
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

            {/* CSS 선택자 설정 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                🎯 클릭 대상 CSS 선택자
              </h3>
              <div>
                <label className="block text-sm font-medium mb-2">
                  선택자 목록 (한 줄에 하나씩)
                </label>
                <textarea
                  value={customSelectors}
                  onChange={(e) => setCustomSelectors(e.target.value)}
                  className="w-full h-32 bg-gray-800 border border-gray-600 text-white p-3 rounded text-sm font-mono"
                  placeholder="a[href]&#10;button&#10;[role=&quot;button&quot;]&#10;[onclick]&#10;[data-action]"
                />
                <div className="mt-2 text-xs text-gray-400">
                  <p>💡 기본 선택자:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><code>a[href]</code> - 모든 링크</li>
                    <li><code>button</code> - 모든 버튼</li>
                    <li><code>[role="button"]</code> - 버튼 역할 요소</li>
                    <li><code>[onclick]</code> - 클릭 이벤트가 있는 요소</li>
                    <li><code>[data-action]</code> - 액션 데이터 속성</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <Button
              onClick={startInteractiveCapture}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-4"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  인터랙션 캡처 진행 중...
                </>
              ) : (
                <>🎯 Interactive Capture 시작</>
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
              🎯 동작 원리
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                <span>초기 페이지 로드 및 스크린샷 촬영</span>
              </div>
              <div className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                <span>각 CSS 선택자별로 클릭 가능한 요소 탐색</span>
              </div>
              <div className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                <span>요소에 호버 → 클릭 → 반응 대기</span>
              </div>
              <div className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">4</span>
                <span>클릭 후 상태 캡처 및 원래 페이지로 복귀</span>
              </div>
              <div className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5">5</span>
                <span>모든 인터랙션을 ZIP으로 압축하여 다운로드</span>
              </div>
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              ⚡ 주요 특징
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <strong className="text-white">🎯 정밀한 타겟팅:</strong> CSS 선택자로 클릭 대상 세밀 제어
              </div>
              <div>
                <strong className="text-white">🔄 자동 복귀:</strong> 클릭 후 자동으로 원래 페이지로 돌아가기
              </div>
              <div>
                <strong className="text-white">👁️ 시각적 피드백:</strong> 호버 효과로 자연스러운 인터랙션
              </div>
              <div>
                <strong className="text-white">⏱️ 타이밍 제어:</strong> 클릭 지연과 대기 시간 조절 가능
              </div>
              <div>
                <strong className="text-white">🛡️ 안정성:</strong> 요소 존재 여부 및 가시성 확인
              </div>
              <div>
                <strong className="text-white">📊 상세 로깅:</strong> 각 단계별 상세한 진행 상황 추적
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>🔗 API: POST /api/interactive-capture</p>
          <p>🌐 웹: http://localhost:3000/interactive-capture</p>
          <p className="mt-2 text-xs">
            원본 인터랙션 캡처 스크립트를 기반으로 한 고도화된 버전입니다.<br/>
            UUID 세션 ID와 고급 오류 처리를 포함합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
