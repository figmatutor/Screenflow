'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CaptureOptions {
  maxLinks?: number;
  maxDepth?: number;
  timeout?: number;
  waitUntil?: 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  captureFlow?: boolean;
  flowKeywords?: string[];
  maxFlowSteps?: number;
}

export default function AutoCaptureZipPage() {
  const [url, setUrl] = useState('https://naver.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 옵션 상태
  const [options, setOptions] = useState<CaptureOptions>({
    maxLinks: 5,
    timeout: 60000,
    waitUntil: 'domcontentloaded',
    captureFlow: false,
    flowKeywords: ['다음', '시작', 'Next', 'Start', '계속', 'Continue'],
    maxFlowSteps: 5
  });

  const startCapture = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Auto Capture ZIP 요청 시작:', url, options);
      
      const response = await fetch('/api/auto-capture-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'ZIP 캡처 실패');
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 파일명 추출 (Content-Disposition 헤더에서)
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `screenshots-${Date.now()}.zip`;
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
      
      setSuccess(`ZIP 파일이 성공적으로 다운로드되었습니다: ${filename}`);
      console.log('Auto Capture ZIP 성공:', filename);
      
    } catch (err) {
      console.error('Auto Capture ZIP 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Auto Capture ZIP 테스트
        </h1>
        
        <Card className="bg-gray-900 border-gray-700 p-6 mb-8">
          <div className="space-y-6">
            {/* URL 입력 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                캡처할 웹사이트 URL
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  최대 링크 수
                </label>
                <Input
                  type="number"
                  value={options.maxLinks}
                  onChange={(e) => setOptions({...options, maxLinks: parseInt(e.target.value) || 5})}
                  min="1"
                  max="20"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  타임아웃 (ms)
                </label>
                <Input
                  type="number"
                  value={options.timeout}
                  onChange={(e) => setOptions({...options, timeout: parseInt(e.target.value) || 60000})}
                  min="10000"
                  max="120000"
                  step="10000"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* 로딩 대기 방식 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                페이지 로딩 대기 방식
              </label>
              <Select 
                value={options.waitUntil} 
                onValueChange={(value: any) => setOptions({...options, waitUntil: value})}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="domcontentloaded">DOM 로드 완료 (빠름)</SelectItem>
                  <SelectItem value="networkidle0">네트워크 완전 정지 (느림, 안정적)</SelectItem>
                  <SelectItem value="networkidle2">네트워크 거의 정지 (보통)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 플로우 캡처 옵션 */}
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="captureFlow"
                  checked={options.captureFlow}
                  onCheckedChange={(checked) => setOptions({...options, captureFlow: !!checked})}
                />
                <label htmlFor="captureFlow" className="text-sm font-medium">
                  버튼 클릭 플로우 캡처 활성화
                </label>
              </div>
              
              {options.captureFlow && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-500">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      클릭할 버튼 키워드 (쉼표로 구분)
                    </label>
                    <Input
                      type="text"
                      value={options.flowKeywords?.join(', ')}
                      onChange={(e) => setOptions({
                        ...options, 
                        flowKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                      })}
                      placeholder="다음, 시작, Next, Start, 계속, Continue"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      최대 플로우 단계 수
                    </label>
                    <Input
                      type="number"
                      value={options.maxFlowSteps}
                      onChange={(e) => setOptions({...options, maxFlowSteps: parseInt(e.target.value) || 5})}
                      min="1"
                      max="10"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <Button
              onClick={startCapture}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
            >
              {loading ? '캡처 중...' : 'ZIP 캡처 시작'}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="bg-red-900/20 border-red-500 p-4 mb-8">
            <h3 className="text-red-400 font-semibold mb-2">오류 발생</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
        )}

        {success && (
          <Card className="bg-green-900/20 border-green-500 p-4 mb-8">
            <h3 className="text-green-400 font-semibold mb-2">성공</h3>
            <p className="text-green-300 text-sm">{success}</p>
          </Card>
        )}

        <Card className="bg-gray-900 border-gray-700 p-6">
          <h3 className="text-xl font-semibold mb-4">기능 설명</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <strong className="text-white">기본 캡처:</strong> 메인 페이지와 내부 링크들의 스크린샷을 ZIP으로 압축
            </div>
            <div>
              <strong className="text-white">플로우 캡처:</strong> 버튼 클릭 시퀀스를 따라가며 각 단계별 스크린샷 캡처
            </div>
            <div>
              <strong className="text-white">Bot Detection 방지:</strong> 실제 브라우저처럼 동작하여 차단 우회
            </div>
            <div>
              <strong className="text-white">환경 최적화:</strong> 로컬/Vercel 환경에 맞는 Puppeteer 설정 자동 적용
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>이 페이지는 Auto Capture ZIP 기능을 테스트하기 위한 페이지입니다.</p>
          <p>API: POST /api/auto-capture-zip</p>
        </div>
      </div>
    </div>
  );
}