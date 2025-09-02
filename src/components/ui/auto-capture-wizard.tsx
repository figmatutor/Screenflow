'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createAutoCapturePoll, PollingManager } from '@/lib/polling-utils';
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
  Clock,
  Eye,
  Image as ImageIcon,
  Settings2
} from 'lucide-react';

// UI 단계 정의
type WizardStep = 'input' | 'crawling' | 'preview' | 'download';

interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  viewportWidth: number;
  viewportHeight: number;
  waitAfterLoad: number;
}

interface CrawledPage {
  url: string;
  title: string;
  filename: string;
  thumbnail: string;
  success: boolean;
  error?: string;
  order: number;
  depth: number;
}

interface CrawlResult {
  baseUrl: string;
  crawledPages: CrawledPage[];
  totalPages: number;
  successCount: number;
  failureCount: number;
}

export function AutoCaptureWizard() {
  // 상태 관리
  const [currentStep, setCurrentStep] = useState<WizardStep>('input');
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // 폴링 관리자 참조
  const pollingManagerRef = useRef<PollingManager | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 크롤링 옵션
  const [crawlOptions, setCrawlOptions] = useState<CrawlOptions>({
    maxDepth: 1,
    maxPages: 10,
    viewportWidth: 1440,
    viewportHeight: 900,
    waitAfterLoad: 2000
  });

  // URL 유효성 검사
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // 1단계: 자동 크롤링 및 캡처 시작
  const startAutoCrawling = async () => {
    if (!isValidUrl(inputUrl)) {
      setError('올바른 URL을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep('crawling');

    try {
      const response = await fetch('/api/auto-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: inputUrl,
          options: crawlOptions
        })
      });

      if (!response.ok) {
        throw new Error('자동 캡처 요청이 실패했습니다.');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      
      // 통합 폴링 시작
      startPolling(data.sessionId);
      
    } catch (error) {
      console.error('Auto crawling error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setCurrentStep('input');
      setIsLoading(false);
    }
  };

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingManagerRef.current) {
        pollingManagerRef.current.stop();
      }
    };
  }, []);

  // 통합 폴링 시작
  const startPolling = (sessionId: string) => {
    // 기존 폴링이 있으면 중지
    if (pollingManagerRef.current) {
      pollingManagerRef.current.stop();
    }

    pollingManagerRef.current = createAutoCapturePoll(
      sessionId,
      // onProgress
      (data) => {
        console.log('[AutoCaptureWizard] 진행 상황:', data);
        // 진행 중인 페이지들 실시간 업데이트
        if (data.crawledPages && data.crawledPages.length > 0) {
          setCrawlResult(prev => prev ? {
            ...prev,
            crawledPages: data.crawledPages,
            totalPages: data.totalPages || prev.totalPages,
            successCount: data.successCount || prev.successCount,
            failureCount: data.failureCount || prev.failureCount
          } : null);
        }
      },
      // onCompleted
      (data) => {
        console.log('[AutoCaptureWizard] ✅ 캡처 완료:', data);
        setCrawlResult({
          baseUrl: data.baseUrl,
          crawledPages: data.crawledPages,
          totalPages: data.totalPages,
          successCount: data.successCount,
          failureCount: data.failureCount
        });
        
        // 성공한 페이지들을 기본 선택
        const successfulPages = data.crawledPages
          .filter((page: CrawledPage) => page.success)
          .map((page: CrawledPage) => page.filename);
        setSelectedPages(successfulPages);
        
        setCurrentStep('preview');
        setIsLoading(false);
        pollingManagerRef.current = null;
      },
      // onFailed
      (errorMessage) => {
        console.error('[AutoCaptureWizard] ❌ 캡처 실패:', errorMessage);
        setError(errorMessage);
        setCurrentStep('input');
        setIsLoading(false);
        pollingManagerRef.current = null;
      }
    );

    pollingManagerRef.current.start();
  };

  // 페이지 선택/해제
  const togglePageSelection = (filename: string) => {
    setSelectedPages(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  // 모든 페이지 선택/해제
  const toggleAllPages = () => {
    if (!crawlResult) return;
    
    const successfulPages = crawlResult.crawledPages
      .filter(page => page.success)
      .map(page => page.filename);
    
    if (selectedPages.length === successfulPages.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(successfulPages);
    }
  };

  // 다운로드 처리
  const handleDownload = async () => {
    if (!sessionId || selectedPages.length === 0) {
      setError('다운로드할 이미지를 선택해주세요.');
      return;
    }

    try {
      console.log('[Frontend] 다운로드 시작:', {
        sessionId,
        selectedPages: selectedPages.length,
        selectedFiles: selectedPages.join(',')
      });

      const downloadUrl = `/api/download?sessionId=${sessionId}&selectedFiles=${encodeURIComponent(selectedPages.join(','))}`;
      
      // 다운로드 전 서버 상태 확인
      const response = await fetch(downloadUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = response.headers.get('content-length');
      console.log('[Frontend] 다운로드 파일 크기:', contentLength, 'bytes');
      
      if (!contentLength || parseInt(contentLength) === 0) {
        throw new Error('다운로드할 파일이 비어있습니다. 이미지 캡처를 다시 시도해주세요.');
      }
      
      // 실제 다운로드 실행
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `auto_capture_${sessionId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('[Frontend] 다운로드 완료');
      setCurrentStep('download');
    } catch (error) {
      console.error('[Frontend] 다운로드 오류:', error);
      setError(`다운로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'}`);
    }
  };

  // 새로 시작
  const startNew = () => {
    setCurrentStep('input');
    setInputUrl('');
    setIsLoading(false);
    setSessionId(null);
    setCrawlResult(null);
    setSelectedPages([]);
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
                자동 크롤링 스크린샷 캡처
              </CardTitle>
              <CardDescription>
                웹페이지를 자동으로 크롤링하고 1440px 고정 너비로 전체 페이지를 캡처합니다.
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
                  onKeyDown={(e) => e.key === 'Enter' && startAutoCrawling()}
                />
              </div>

              {/* 주요 설정 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-md">
                <div>
                  <label className="text-sm font-medium text-gray-700">크롤링 깊이</label>
                  <select
                    value={crawlOptions.maxDepth}
                    onChange={(e) => setCrawlOptions(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value={0}>메인 페이지만 (깊이 0)</option>
                    <option value={1}>메인 + 1단계 링크 (깊이 1)</option>
                    <option value={2}>메인 + 2단계 링크 (깊이 2)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {crawlOptions.maxDepth === 0 && '메인 페이지만 캡처'}
                    {crawlOptions.maxDepth === 1 && '메인 페이지 + 연결된 링크들 캡처'}
                    {crawlOptions.maxDepth === 2 && '메인 + 1단계 + 2단계 링크들 캡처'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">최대 페이지 수</label>
                  <select
                    value={crawlOptions.maxPages}
                    onChange={(e) => setCrawlOptions(prev => ({ ...prev, maxPages: parseInt(e.target.value) }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value={5}>5개</option>
                    <option value={10}>10개</option>
                    <option value={15}>15개</option>
                    <option value={20}>20개</option>
                    <option value={30}>30개</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    캡처할 최대 페이지 개수
                  </p>
                </div>
              </div>

              {/* 고급 옵션 */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {showAdvanced ? '고급 옵션 숨기기' : '고급 옵션 표시'}
                </Button>
                
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                    <div>
                      <label className="text-sm font-medium">뷰포트 너비 (px)</label>
                      <Input
                        type="number"
                        min="1200"
                        max="1920"
                        step="120"
                        value={crawlOptions.viewportWidth}
                        onChange={(e) => setCrawlOptions(prev => ({ ...prev, viewportWidth: parseInt(e.target.value) }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">기본값: 1440px</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">로딩 대기 시간 (초)</label>
                      <select
                        value={crawlOptions.waitAfterLoad / 1000}
                        onChange={(e) => setCrawlOptions(prev => ({ ...prev, waitAfterLoad: parseInt(e.target.value) * 1000 }))}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value={1}>1초</option>
                        <option value={2}>2초 (기본값)</option>
                        <option value={3}>3초</option>
                        <option value={5}>5초</option>
                        <option value={10}>10초</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">페이지 로딩 후 대기 시간</p>
                    </div>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}
              
              <Button 
                onClick={startAutoCrawling} 
                disabled={!inputUrl || isLoading}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                자동 크롤링 및 캡처 시작
              </Button>
            </CardContent>
          </Card>
        );

      case 'crawling':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin" />
                자동 크롤링 진행 중...
              </CardTitle>
              <CardDescription>
                페이지를 탐색하고 스크린샷을 캡처하고 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  시작 페이지: <span className="font-medium">{inputUrl}</span>
                </p>
                <Progress value={66} className="w-full" />
                <p className="text-xs text-gray-500 mt-2">
                  설정: 최대 {crawlOptions.maxPages}페이지, 깊이 {crawlOptions.maxDepth}, {crawlOptions.viewportWidth}px 너비
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 'preview':
        return (
          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-6 w-6" />
                캡처된 페이지 미리보기 ({crawlResult?.successCount || 0}개)
              </CardTitle>
              <CardDescription>
                원하는 이미지를 선택하여 다운로드하세요. 이미지를 클릭하면 크게 볼 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  기본 URL: {crawlResult?.baseUrl}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedPages.length}개 선택됨
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllPages}
                  >
                    {selectedPages.length === crawlResult?.crawledPages.filter(p => p.success).length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <ScrollArea className="h-96">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {crawlResult?.crawledPages.map((page, index) => (
                    <div key={index} className={`border rounded-lg p-3 ${page.success ? 'hover:bg-gray-50' : 'bg-red-50'}`}>
                      <div className="flex items-start gap-3">
                        {page.success && (
                          <Checkbox
                            checked={selectedPages.includes(page.filename)}
                            onCheckedChange={() => togglePageSelection(page.filename)}
                            className="mt-1"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          {page.success ? (
                            <div className="space-y-2">
                              <img
                                src={page.thumbnail}
                                alt={page.title}
                                className="w-full h-40 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => window.open(page.thumbnail, '_blank')}
                              />
                              <div>
                                <p className="font-medium text-sm truncate">{page.title}</p>
                                <p className="text-xs text-gray-600 truncate">{page.url}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {page.order}번째
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    깊이 {page.depth}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full h-40 bg-gray-200 rounded border flex items-center justify-center">
                                <div className="text-center">
                                  <X className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                  <p className="text-xs text-red-600">캡처 실패</p>
                                </div>
                              </div>
                              <div>
                                <p className="font-medium text-sm text-red-600 truncate">{page.url}</p>
                                <p className="text-xs text-red-500">{page.error}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={startNew} disabled={isLoading}>
                  새로 시작
                </Button>
                <Button 
                  onClick={handleDownload} 
                  disabled={selectedPages.length === 0 || isLoading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  선택된 {selectedPages.length}개 이미지 다운로드
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'download':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                다운로드 완료!
              </CardTitle>
              <CardDescription>
                선택된 이미지들이 성공적으로 다운로드되었습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="p-4 bg-green-50 rounded-md">
                  <ImageIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">
                    {selectedPages.length}개 이미지 다운로드됨
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    1440px 고정 너비로 캡처된 전체 페이지 스크린샷
                  </p>
                </div>
              </div>

              <Button onClick={startNew} className="w-full">
                새로운 캡처 시작
              </Button>
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
            {(['input', 'crawling', 'preview', 'download'] as WizardStep[]).map((step, index) => {
              const stepNames = {
                input: 'URL 입력',
                crawling: '자동 크롤링',
                preview: '미리보기',
                download: '다운로드'
              };
              
              const isActive = currentStep === step;
              const isCompleted = ['input', 'crawling', 'preview', 'download'].indexOf(currentStep) > index;
              
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
                  {index < 3 && <div className="w-8 h-px bg-gray-300 mx-4" />}
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
