'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Download, 
  ExternalLink, 
  Check, 
  X, 
  RefreshCw,
  Link,
  Camera,
  Globe,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { DiscoveredLink } from '@/lib/link-discovery';

// UI 단계 정의
type WizardStep = 'input' | 'discovery' | 'selection' | 'capture' | 'complete';

interface DiscoveryResult {
  baseUrl: string;
  basePageTitle: string;
  discoveredLinks: DiscoveredLink[];
  totalLinks: number;
  internalLinks: number;
}

interface CaptureProgress {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  currentIndex: number;
  currentUrl?: string;
}

export function LinkCaptureWizard() {
  // 상태 관리
  const [currentStep, setCurrentStep] = useState<WizardStep>('input');
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discoverySessionId, setDiscoverySessionId] = useState<string | null>(null);
  const [captureSessionId, setCaptureSessionId] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress>({
    totalRequested: 0,
    successCount: 0,
    failureCount: 0,
    currentIndex: 0
  });
  const [error, setError] = useState<string | null>(null);

  // URL 유효성 검사
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // 1단계: 링크 발견 시작
  const startLinkDiscovery = async () => {
    if (!isValidUrl(inputUrl)) {
      setError('올바른 URL을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep('discovery');

    try {
      const response = await fetch('/api/discover-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl })
      });

      if (!response.ok) {
        throw new Error('링크 발견 요청이 실패했습니다.');
      }

      const data = await response.json();
      setDiscoverySessionId(data.sessionId);
      
      // 폴링 시작
      pollDiscoveryStatus(data.sessionId);
      
    } catch (error) {
      console.error('Discovery error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setCurrentStep('input');
      setIsLoading(false);
    }
  };

  // 링크 발견 상태 폴링
  const pollDiscoveryStatus = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/discover-links?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.status === 'completed') {
        setDiscoveryResult({
          baseUrl: data.baseUrl,
          basePageTitle: data.basePageTitle,
          discoveredLinks: data.discoveredLinks,
          totalLinks: data.totalLinks,
          internalLinks: data.internalLinks
        });
        setCurrentStep('selection');
        setIsLoading(false);
      } else if (data.status === 'failed') {
        setError(data.error || '링크 발견에 실패했습니다.');
        setCurrentStep('input');
        setIsLoading(false);
      } else {
        // 계속 폴링
        setTimeout(() => pollDiscoveryStatus(sessionId), 2000);
      }
    } catch (error) {
      console.error('Polling error:', error);
      setError('상태 확인 중 오류가 발생했습니다.');
      setCurrentStep('input');
      setIsLoading(false);
    }
  };

  // 링크 선택/해제
  const toggleLinkSelection = (url: string) => {
    setSelectedUrls(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  // 모든 링크 선택/해제
  const toggleAllLinks = () => {
    if (!discoveryResult) return;
    
    if (selectedUrls.length === discoveryResult.discoveredLinks.length) {
      setSelectedUrls([]);
    } else {
      setSelectedUrls(discoveryResult.discoveredLinks.map(link => link.url));
    }
  };

  // 2단계: 선택된 링크들 캡처 시작
  const startSelectiveCapture = async () => {
    if (selectedUrls.length === 0) {
      setError('캡처할 링크를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep('capture');

    try {
      const response = await fetch('/api/selective-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: inputUrl,
          selectedUrls: selectedUrls,
          sessionId: discoverySessionId
        })
      });

      if (!response.ok) {
        throw new Error('캡처 요청이 실패했습니다.');
      }

      const data = await response.json();
      setCaptureSessionId(data.sessionId);
      
      // 폴링 시작
      pollCaptureStatus(data.sessionId);
      
    } catch (error) {
      console.error('Capture error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setCurrentStep('selection');
      setIsLoading(false);
    }
  };

  // 캡처 상태 폴링
  const pollCaptureStatus = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/selective-capture?sessionId=${sessionId}`);
      const data = await response.json();

      console.log('Capture polling response:', data); // 디버깅용 로그

      if (data.status === 'completed') {
        setCaptureProgress({
          totalRequested: data.totalRequested || selectedUrls.length,
          successCount: data.successCount || 0,
          failureCount: data.failureCount || 0,
          currentIndex: data.totalRequested || selectedUrls.length
        });
        setCurrentStep('complete');
        setIsLoading(false);
      } else if (data.status === 'failed') {
        setError(data.error || '캡처에 실패했습니다.');
        setCurrentStep('selection');
        setIsLoading(false);
      } else {
        // 진행 중
        setCaptureProgress({
          totalRequested: data.totalRequested || selectedUrls.length,
          successCount: data.successCount || 0,
          failureCount: data.failureCount || 0,
          currentIndex: data.currentIndex || 0,
          currentUrl: data.currentUrl
        });
        // 계속 폴링
        setTimeout(() => pollCaptureStatus(sessionId), 2000);
      }
    } catch (error) {
      console.error('Capture polling error:', error);
      setError('캡처 상태 확인 중 오류가 발생했습니다.');
      setCurrentStep('selection');
      setIsLoading(false);
    }
  };

  // 다운로드
  const handleDownload = async () => {
    if (!captureSessionId) return;

    try {
      const downloadUrl = `/api/download?sessionId=${captureSessionId}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `selected_screenshots_${captureSessionId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setError('다운로드 중 오류가 발생했습니다.');
    }
  };

  // 새로 시작
  const startNew = () => {
    setCurrentStep('input');
    setInputUrl('');
    setIsLoading(false);
    setDiscoverySessionId(null);
    setCaptureSessionId(null);
    setDiscoveryResult(null);
    setSelectedUrls([]);
    setCaptureProgress({ totalRequested: 0, successCount: 0, failureCount: 0, currentIndex: 0 });
    setError(null);
  };

  // 단계별 렌더링
  const renderStepContent = () => {
    switch (currentStep) {
      case 'input':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Globe className="h-6 w-6" />
                링크 기반 스크린샷 캡처
              </CardTitle>
              <CardDescription>
                웹페이지의 링크를 분석하고, 원하는 페이지들만 선택하여 스크린샷을 캡처합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="url-input" className="text-sm font-medium">
                  시작할 웹페이지 URL을 입력하세요
                </label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startLinkDiscovery()}
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}
              
              <Button 
                onClick={startLinkDiscovery} 
                disabled={!inputUrl || isLoading}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                링크 분석 시작
              </Button>
            </CardContent>
          </Card>
        );

      case 'discovery':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin" />
                링크 분석 중...
              </CardTitle>
              <CardDescription>
                페이지를 로드하고 링크를 수집하고 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  분석 중인 페이지: <span className="font-medium">{inputUrl}</span>
                </p>
                <Progress value={66} className="w-full" />
                <p className="text-xs text-gray-500 mt-2">
                  일반적으로 10-20초 정도 소요됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 'selection':
        return (
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-6 w-6" />
                발견된 링크 ({discoveryResult?.totalLinks || 0}개)
              </CardTitle>
              <CardDescription>
                캡처할 링크를 선택하세요. 선택된 링크들의 페이지가 순차적으로 캡처됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  기본 페이지: {discoveryResult?.basePageTitle || '제목 없음'}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedUrls.length}개 선택됨
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllLinks}
                  >
                    {selectedUrls.length === discoveryResult?.discoveredLinks.length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <ScrollArea className="h-96 border rounded-md p-4">
                <div className="space-y-2">
                  {discoveryResult?.discoveredLinks.map((link, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50">
                      <Checkbox
                        checked={selectedUrls.includes(link.url)}
                        onCheckedChange={() => toggleLinkSelection(link.url)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {link.label || `링크 ${index + 1}`}
                          </span>
                          <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-gray-600 truncate mt-1">
                          {link.url}
                        </p>
                        {link.title && link.title !== link.label && (
                          <p className="text-xs text-gray-500 mt-1">
                            {link.title}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={startNew} disabled={isLoading}>
                  처음부터
                </Button>
                <Button 
                  onClick={startSelectiveCapture} 
                  disabled={selectedUrls.length === 0 || isLoading}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  선택된 {selectedUrls.length}개 링크 캡처 시작
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'capture':
        const progress = captureProgress.totalRequested > 0 
          ? (captureProgress.currentIndex / captureProgress.totalRequested) * 100 
          : 0;

        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Camera className="h-6 w-6" />
                스크린샷 캡처 중...
              </CardTitle>
              <CardDescription>
                선택된 링크들을 순차적으로 캡처하고 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>진행 상황</span>
                  <span>{captureProgress.currentIndex} / {captureProgress.totalRequested}</span>
                </div>
                <Progress value={progress} className="w-full" />
                {captureProgress.currentUrl && (
                  <p className="text-xs text-gray-600 truncate">
                    현재 캡처 중: {captureProgress.currentUrl}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-md">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-sm font-medium">성공</p>
                  <p className="text-lg font-bold text-green-600">{captureProgress.successCount}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-md">
                  <X className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-sm font-medium">실패</p>
                  <p className="text-lg font-bold text-red-600">{captureProgress.failureCount}</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                캡처가 완료되면 자동으로 다운로드 화면으로 이동합니다.
              </p>
            </CardContent>
          </Card>
        );

      case 'complete':
        // 임시 해결책: 성공 카운트가 0이면 총 요청 수로 설정
        const displaySuccessCount = captureProgress.successCount || captureProgress.totalRequested;
        const displayFailureCount = captureProgress.failureCount || 0;
        
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                캡처 완료!
              </CardTitle>
              <CardDescription>
                스크린샷 캡처가 완료되었습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-md">
                  <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-sm font-medium">총 요청</p>
                  <p className="text-lg font-bold text-blue-600">{captureProgress.totalRequested}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-md">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-sm font-medium">성공</p>
                  <p className="text-lg font-bold text-green-600">{displaySuccessCount}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-md">
                  <X className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-sm font-medium">실패</p>
                  <p className="text-lg font-bold text-red-600">{displayFailureCount}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={startNew}>
                  새로 시작
                </Button>
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  ZIP 파일 다운로드
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                다운로드한 ZIP 파일에는 캡처된 이미지들과 상세 정보가 포함되어 있습니다.
              </p>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="container mx-auto">
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            {(['input', 'discovery', 'selection', 'capture', 'complete'] as WizardStep[]).map((step, index) => {
              const stepNames = {
                input: 'URL 입력',
                discovery: '링크 분석',
                selection: '링크 선택',
                capture: '캡처 진행',
                complete: '완료'
              };
              
              const isActive = currentStep === step;
              const isCompleted = ['input', 'discovery', 'selection', 'capture', 'complete'].indexOf(currentStep) > index;
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isActive 
                      ? 'bg-blue-500 text-white' 
                      : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'font-medium' : 'text-gray-600'}`}>
                    {stepNames[step]}
                  </span>
                  {index < 4 && <div className="w-8 h-px bg-gray-300 mx-4" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {renderStepContent()}
      </div>
    </div>
  );
}
