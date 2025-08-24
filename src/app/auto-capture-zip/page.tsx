'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Globe, Camera, Zap, AlertCircle, CheckCircle } from 'lucide-react';

interface CaptureOptions {
  maxLinks: number;
  maxDepth: number;
  timeout: number;
  waitUntil: 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  captureFlow: boolean;
  flowKeywords: string[];
  maxFlowSteps: number;
}

export default function AutoCaptureZipPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  
  const [options, setOptions] = useState<CaptureOptions>({
    maxLinks: 5,
    maxDepth: 1,
    timeout: 60000,
    waitUntil: 'networkidle2',
    captureFlow: false,
    flowKeywords: ['다음', '시작', 'Next', 'Start', '계속', 'Continue'],
    maxFlowSteps: 5
  });

  const handleCapture = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setStatus('링크 수집 및 스크린샷 캡처를 시작합니다...');

    try {
      // URL 유효성 검사
      try {
        new URL(url);
      } catch {
        throw new Error('유효하지 않은 URL 형식입니다.');
      }

      setProgress(10);
      setStatus('브라우저를 초기화하고 있습니다...');

      const response = await fetch('/api/auto-capture-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      setProgress(30);
      setStatus(options.captureFlow 
        ? '페이지를 로드하고 버튼 클릭 플로우를 시작합니다...' 
        : '내부 링크를 수집하고 있습니다...'
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || '스크린샷 캡처 실패');
      }

      setProgress(70);
      setStatus(options.captureFlow 
        ? '버튼 클릭 플로우를 실행하고 각 단계를 캡처하고 있습니다...' 
        : '스크린샷을 캡처하고 ZIP 파일을 생성하고 있습니다...'
      );

      // ZIP 파일 다운로드
      const blob = await response.blob();
      
      setProgress(90);
      setStatus('ZIP 파일을 다운로드합니다...');

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // 파일명 생성
      const domain = new URL(url).hostname;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      link.download = `screenshots-${domain}-${timestamp}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      setStatus('ZIP 파일 다운로드가 완료되었습니다! 🎉');

    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress(0);
        setStatus('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Camera className="w-8 h-8 text-blue-400" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Auto Capture ZIP
              </h1>
            </div>
            <p className="text-gray-300 text-lg">
              웹사이트의 내부 링크를 탐색하거나 버튼 클릭 플로우를 따라가며 스크린샷을 촬영하고 ZIP 파일로 다운로드합니다
            </p>
          </div>

          {/* 메인 카드 */}
          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="w-5 h-5" />
                URL 입력 및 설정
              </CardTitle>
              <CardDescription className="text-gray-300">
                캡처할 웹사이트의 URL을 입력하고 옵션을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* URL 입력 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">웹사이트 URL</label>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                  disabled={loading}
                />
              </div>

              <Separator className="bg-gray-600" />

              {/* 옵션 설정 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">최대 링크 수</label>
                  <Input
                    type="number"
                    value={options.maxLinks}
                    onChange={(e) => setOptions(prev => ({ ...prev, maxLinks: parseInt(e.target.value) || 5 }))}
                    min="1"
                    max="20"
                    className="bg-gray-900/50 border-gray-600 text-white"
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">타임아웃 (ms)</label>
                  <Input
                    type="number"
                    value={options.timeout}
                    onChange={(e) => setOptions(prev => ({ ...prev, timeout: parseInt(e.target.value) || 60000 }))}
                    min="30000"
                    max="120000"
                    step="10000"
                    className="bg-gray-900/50 border-gray-600 text-white"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 대기 조건 설정 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">페이지 로딩 완료 조건</label>
                <select
                  value={options.waitUntil}
                  onChange={(e) => setOptions(prev => ({ ...prev, waitUntil: e.target.value as any }))}
                  className="w-full p-2 rounded-md bg-gray-900/50 border border-gray-600 text-white focus:border-blue-500"
                  disabled={loading}
                >
                  <option value="networkidle2">네트워크 거의 대기 (추천)</option>
                  <option value="networkidle0">네트워크 완전 대기 (정확함)</option>
                  <option value="domcontentloaded">DOM 로딩 완료 (빠름)</option>
                </select>
              </div>

              <Separator className="bg-gray-600" />

              {/* 플로우 캡처 설정 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="captureFlow"
                    checked={options.captureFlow}
                    onChange={(e) => setOptions(prev => ({ ...prev, captureFlow: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded focus:ring-blue-500"
                    disabled={loading}
                  />
                  <label htmlFor="captureFlow" className="text-sm font-medium text-gray-200">
                    🔄 플로우 캡처 모드 (버튼 클릭 시퀀스)
                  </label>
                </div>
                
                {options.captureFlow && (
                  <div className="ml-7 space-y-3 p-3 bg-gray-900/30 rounded-md border border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">최대 플로우 단계</label>
                        <Input
                          type="number"
                          value={options.maxFlowSteps}
                          onChange={(e) => setOptions(prev => ({ ...prev, maxFlowSteps: parseInt(e.target.value) || 5 }))}
                          min="1"
                          max="10"
                          className="bg-gray-800/50 border-gray-600 text-white text-sm"
                          disabled={loading}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">클릭 키워드</label>
                        <Input
                          type="text"
                          value={options.flowKeywords.join(', ')}
                          onChange={(e) => setOptions(prev => ({ 
                            ...prev, 
                            flowKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) 
                          }))}
                          placeholder="다음, 시작, Next, Start"
                          className="bg-gray-800/50 border-gray-600 text-white text-sm"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      💡 플로우 모드에서는 입력한 키워드가 포함된 버튼을 순차적으로 클릭하며 각 단계의 스크린샷을 촬영합니다.
                    </div>
                  </div>
                )}
              </div>

              {/* 진행 상태 */}
              {loading && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="text-sm text-gray-300">{status}</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-300 text-sm">{error}</span>
                </div>
              )}

              {/* 성공 메시지 */}
              {progress === 100 && !loading && (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-md">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 text-sm">{status}</span>
                </div>
              )}

              {/* 실행 버튼 */}
              <Button
                onClick={handleCapture}
                disabled={loading || !url}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 transition-all duration-300"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    캡처 진행 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    스크린샷 캡처 & ZIP 다운로드
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 정보 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <Card className="bg-gray-800/30 border-gray-700">
              <CardContent className="p-4 text-center">
                <Globe className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h3 className="text-white font-semibold mb-1">내부 링크 탐색</h3>
                <p className="text-gray-400 text-sm">동일 도메인의 내부 링크만 자동 수집</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800/30 border-gray-700">
              <CardContent className="p-4 text-center">
                <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <h3 className="text-white font-semibold mb-1">플로우 캡처</h3>
                <p className="text-gray-400 text-sm">버튼 클릭 시퀀스를 따라가며 자동 캡처</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800/30 border-gray-700">
              <CardContent className="p-4 text-center">
                <Camera className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-white font-semibold mb-1">전체 페이지 캡처</h3>
                <p className="text-gray-400 text-sm">각 페이지의 전체 스크린샷 촬영</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800/30 border-gray-700">
              <CardContent className="p-4 text-center">
                <Download className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h3 className="text-white font-semibold mb-1">ZIP 압축 다운로드</h3>
                <p className="text-gray-400 text-sm">모든 이미지를 ZIP으로 압축하여 제공</p>
              </CardContent>
            </Card>
          </div>

          {/* 사용법 안내 */}
          <Card className="bg-gray-800/20 border-gray-700 mt-8">
            <CardHeader>
              <CardTitle className="text-white">사용법 안내</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">1</Badge>
                <p>캡처할 웹사이트의 URL을 입력합니다 (예: https://example.com)</p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">2</Badge>
                <p>캡처 모드를 선택합니다: <strong>링크 탐색</strong> 또는 <strong>플로우 캡처</strong></p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">3</Badge>
                <p>플로우 캡처 시 클릭할 버튼의 키워드를 설정합니다 (예: "다음", "시작")</p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">4</Badge>
                <p>"스크린샷 캡처 & ZIP 다운로드" 버튼을 클릭합니다</p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">5</Badge>
                <p>처리가 완료되면 ZIP 파일이 자동으로 다운로드됩니다</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
