'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface DiscoveredLink {
  url: string;
  index: number;
}

interface Screenshot {
  url: string;
  filename: string;
  size: number;
  hasBuffer: boolean;
}

interface CaptureSession {
  sessionId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  screenshots: Screenshot[];
  error?: string;
}

export default function SelectiveCapturePage() {
  const [step, setStep] = useState<'input' | 'discover' | 'capture' | 'select' | 'download'>('input');
  const [url, setUrl] = useState('');
  const [maxLinks, setMaxLinks] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 링크 수집 단계
  const [discoveredLinks, setDiscoveredLinks] = useState<DiscoveredLink[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<number[]>([]);
  
  // 캡처 단계
  const [sessionId, setSessionId] = useState<string>('');
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  
  // 선택 단계
  const [selectedScreenshots, setSelectedScreenshots] = useState<number[]>([]);

  // 1. 링크 수집
  const discoverLinks = async () => {
    if (!url.trim()) {
      setError('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/discover-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), maxLinks })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const links = data.links.map((link: string, index: number) => ({
          url: link,
          index
        }));
        
        setDiscoveredLinks(links);
        setSelectedLinks(links.map((_, i) => i)); // 기본적으로 모든 링크 선택
        setStep('discover');
      } else {
        setError(data.error || '링크 수집에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2. 스크린샷 캡처 시작
  const startCapture = async () => {
    if (selectedLinks.length === 0) {
      setError('캡처할 링크를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    
    try {
      const urlsToCapture = selectedLinks.map(index => discoveredLinks[index].url);
      
      const response = await fetch('/api/capture-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: newSessionId, 
          urls: urlsToCapture 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStep('capture');
        // 진행 상황 폴링 시작
        pollCaptureProgress(newSessionId);
      } else {
        setError(data.error || '캡처 시작에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 3. 캡처 진행 상황 폴링
  const pollCaptureProgress = async (sessionId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/capture-screenshots?sessionId=${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          setCaptureSession(data);
          
          if (data.status === 'completed') {
            setStep('select');
            setSelectedScreenshots([]); // 선택 초기화
          } else if (data.status === 'failed') {
            setError(data.error || '캡처 작업이 실패했습니다.');
          } else if (data.status === 'processing') {
            // 3초 후 다시 폴링
            setTimeout(poll, 3000);
          }
        }
      } catch (err) {
        console.error('폴링 오류:', err);
        setTimeout(poll, 5000); // 오류 시 5초 후 재시도
      }
    };

    poll();
  };

  // 4. 선택된 스크린샷 다운로드
  const downloadSelected = async () => {
    if (selectedScreenshots.length === 0) {
      setError('다운로드할 이미지를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          selectedIndices: selectedScreenshots 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `selected_screenshots_${Date.now()}.zip`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setStep('download');
    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 체크박스 토글
  const toggleLinkSelection = (index: number) => {
    setSelectedLinks(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleScreenshotSelection = (index: number) => {
    setSelectedScreenshots(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const resetProcess = () => {
    setStep('input');
    setUrl('');
    setError(null);
    setDiscoveredLinks([]);
    setSelectedLinks([]);
    setSessionId('');
    setCaptureSession(null);
    setSelectedScreenshots([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">선택적 스크린샷 캡처</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            링크 수집 → 스크린샷 캡처 → 원하는 이미지 선택 → 다운로드
          </p>
        </div>

        {/* 단계 표시기 */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { key: 'input', label: 'URL 입력' },
              { key: 'discover', label: '링크 선택' },
              { key: 'capture', label: '캡처 진행' },
              { key: 'select', label: '이미지 선택' },
              { key: 'download', label: '다운로드' }
            ].map((stepInfo, index) => (
              <div key={stepInfo.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === stepInfo.key ? 'bg-blue-600 text-white' :
                  ['discover', 'capture', 'select', 'download'].indexOf(step) > 
                  ['discover', 'capture', 'select', 'download'].indexOf(stepInfo.key as any)
                    ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepInfo.key ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {stepInfo.label}
                </span>
                {index < 4 && <div className="w-8 h-px bg-gray-600 ml-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <Card className="bg-red-900/50 border-red-700 mb-6">
            <div className="p-4">
              <p className="text-red-200">{error}</p>
            </div>
          </Card>
        )}

        {/* 단계별 UI */}
        <div className="max-w-4xl mx-auto">
          
          {/* 1단계: URL 입력 */}
          {step === 'input' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">1. URL 입력</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">캡처할 웹사이트 URL</label>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">최대 링크 수</label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={maxLinks}
                      onChange={(e) => setMaxLinks(parseInt(e.target.value) || 10)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button 
                    onClick={discoverLinks}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? '링크 수집 중...' : '링크 수집 시작'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 2단계: 링크 선택 */}
          {step === 'discover' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">2. 링크 선택</h2>
                  <Badge variant="secondary">{discoveredLinks.length}개 발견</Badge>
                </div>
                
                <div className="mb-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedLinks(discoveredLinks.map((_, i) => i))}
                  >
                    전체 선택
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedLinks([])}
                  >
                    전체 해제
                  </Button>
                  <Badge variant="outline" className="ml-auto">
                    {selectedLinks.length}개 선택됨
                  </Badge>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                  {discoveredLinks.map((link, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded">
                      <Checkbox
                        checked={selectedLinks.includes(index)}
                        onCheckedChange={() => toggleLinkSelection(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {link.url}
                        </p>
                        <p className="text-xs text-gray-400">링크 #{index + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setStep('input')}
                  >
                    뒤로
                  </Button>
                  <Button 
                    onClick={startCapture}
                    disabled={loading || selectedLinks.length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {loading ? '캡처 시작 중...' : `선택한 ${selectedLinks.length}개 링크 캡처하기`}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 3단계: 캡처 진행 */}
          {step === 'capture' && captureSession && (
            <Card className="bg-gray-800/50 border-gray-700">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">3. 스크린샷 캡처 진행 중</h2>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>진행률</span>
                      <span>{captureSession.progress} / {captureSession.total}</span>
                    </div>
                    <Progress 
                      value={(captureSession.progress / captureSession.total) * 100} 
                      className="w-full"
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-gray-400">
                      {captureSession.status === 'processing' 
                        ? '스크린샷을 촬영하고 있습니다...' 
                        : '캡처가 완료되었습니다!'
                      }
                    </p>
                  </div>

                  {captureSession.status === 'processing' && (
                    <div className="animate-pulse text-center">
                      <div className="inline-block w-4 h-4 bg-blue-600 rounded-full mr-2"></div>
                      잠시만 기다려주세요...
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 4단계: 이미지 선택 */}
          {step === 'select' && captureSession && (
            <Card className="bg-gray-800/50 border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">4. 다운로드할 이미지 선택</h2>
                  <Badge variant="secondary">{captureSession.screenshots.length}개 캡처됨</Badge>
                </div>

                <div className="mb-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedScreenshots(
                      captureSession.screenshots
                        .map((_, i) => i)
                        .filter(i => captureSession.screenshots[i].hasBuffer)
                    )}
                  >
                    성공한 것만 전체 선택
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedScreenshots([])}
                  >
                    전체 해제
                  </Button>
                  <Badge variant="outline" className="ml-auto">
                    {selectedScreenshots.length}개 선택됨
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {captureSession.screenshots.map((screenshot, index) => (
                    <div 
                      key={index} 
                      className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedScreenshots.includes(index) 
                          ? 'border-blue-500 bg-blue-500/20' 
                          : 'border-gray-600 hover:border-gray-500'
                      } ${
                        !screenshot.hasBuffer ? 'opacity-50' : ''
                      }`}
                      onClick={() => screenshot.hasBuffer && toggleScreenshotSelection(index)}
                    >
                      <div className="aspect-video bg-gray-700 flex items-center justify-center">
                        {screenshot.hasBuffer ? (
                          <img 
                            src={`/api/download-selected?sessionId=${sessionId}&index=${index}`}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWQgRXJyb3I8L3RleHQ+PC9zdmc+';
                            }}
                          />
                        ) : (
                          <div className="text-center text-red-400">
                            <div className="text-2xl mb-1">⚠️</div>
                            <div className="text-xs">캡처 실패</div>
                          </div>
                        )}
                      </div>
                      
                      {screenshot.hasBuffer && (
                        <div className="absolute top-2 right-2">
                          <Checkbox
                            checked={selectedScreenshots.includes(index)}
                            onCheckedChange={() => toggleScreenshotSelection(index)}
                            className="bg-white/80"
                          />
                        </div>
                      )}
                      
                      <div className="p-2 bg-gray-800/90">
                        <p className="text-xs truncate" title={screenshot.url}>
                          {screenshot.url}
                        </p>
                        <p className="text-xs text-gray-400">
                          {screenshot.hasBuffer 
                            ? `${(screenshot.size / 1024).toFixed(1)}KB` 
                            : '실패'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={resetProcess}
                  >
                    처음부터
                  </Button>
                  <Button 
                    onClick={downloadSelected}
                    disabled={loading || selectedScreenshots.length === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? '다운로드 준비 중...' : `선택한 ${selectedScreenshots.length}개 이미지 다운로드`}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 5단계: 다운로드 완료 */}
          {step === 'download' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <div className="p-6 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold mb-4">다운로드 완료!</h2>
                <p className="text-gray-400 mb-6">
                  선택하신 이미지들이 ZIP 파일로 다운로드되었습니다.
                </p>
                <Button 
                  onClick={resetProcess}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  새로운 캡처 시작하기
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

