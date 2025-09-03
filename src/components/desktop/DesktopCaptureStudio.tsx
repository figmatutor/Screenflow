'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Copy, 
  FolderOpen, 
  Zap, 
  Monitor, 
  Settings,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  isElectronEnvironment, 
  downloadFile, 
  downloadZipFile, 
  openDownloadFolder, 
  copyToClipboard,
  getAppInfo,
  ENVIRONMENT_CONFIG 
} from '@/lib/electron-utils';
import { createAutoCapturePoll, PollingManager } from '@/lib/polling-utils';

interface CrawledPage {
  url: string;
  title: string;
  filename: string;
  thumbnail?: string;
  success: boolean;
  error?: string;
  order: number;
  depth: number;
  links?: string[];
  capturedAt: Date;
}

interface CrawlResult {
  baseUrl: string;
  crawledPages: CrawledPage[];
  totalPages: number;
  successCount: number;
  failureCount: number;
}

type CaptureStep = 'input' | 'loading' | 'preview' | 'complete';

export function DesktopCaptureStudio() {
  // 상태 관리
  const [currentStep, setCurrentStep] = useState<CaptureStep>('input');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<any>(null);
  
  // 폴링 관리자
  const [pollingManager, setPollingManager] = useState<PollingManager | null>(null);

  // 앱 정보 로드
  useEffect(() => {
    const loadAppInfo = async () => {
      const info = await getAppInfo();
      setAppInfo(info);
    };
    loadAppInfo();
  }, []);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingManager) {
        pollingManager.stop();
      }
    };
  }, [pollingManager]);

  // 자동 캡처 시작
  const startAutoCapture = useCallback(async () => {
    if (!url.trim()) {
      setError('URL을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep('loading');

    try {
      console.log('[DesktopCapture] 자동 캡처 시작:', url);

      const response = await fetch('/api/auto-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url,
          options: {
            maxDepth: 1,
            maxPages: 5
          }
        })
      });

      if (!response.ok) {
        throw new Error('자동 캡처 요청이 실패했습니다.');
      }

      const data = await response.json();
      console.log('[DesktopCapture] 세션 생성 완료:', data.sessionId);

      // 폴링 시작
      const manager = createAutoCapturePoll(
        data.sessionId,
        // onProgress
        (progressData) => {
          console.log('[DesktopCapture] 진행 상황:', progressData);
        },
        // onCompleted
        (completedData) => {
          console.log('[DesktopCapture] 캡처 완료:', completedData);
          setCrawlResult({
            baseUrl: completedData.baseUrl,
            crawledPages: completedData.crawledPages,
            totalPages: completedData.totalPages,
            successCount: completedData.successCount,
            failureCount: completedData.failureCount
          });

          // 성공한 페이지들을 기본 선택
          const successfulPages = completedData.crawledPages
            .filter((page: CrawledPage) => page.success)
            .map((page: CrawledPage) => page.filename);
          setSelectedPages(successfulPages);

          setCurrentStep('preview');
          setIsLoading(false);
          setPollingManager(null);
        },
        // onFailed
        (errorMessage) => {
          console.error('[DesktopCapture] 캡처 실패:', errorMessage);
          setError(errorMessage);
          setCurrentStep('input');
          setIsLoading(false);
          setPollingManager(null);
        }
      );

      manager.start();
      setPollingManager(manager);

    } catch (error) {
      console.error('[DesktopCapture] 요청 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setCurrentStep('input');
      setIsLoading(false);
    }
  }, [url]);

  // 개별 파일 다운로드
  const handleDownloadSingle = useCallback(async (page: CrawledPage) => {
    try {
      console.log('[DesktopCapture] 개별 다운로드 시작:', page.filename);

      const response = await fetch(`/api/download?filename=${encodeURIComponent(page.filename)}`);
      if (!response.ok) {
        throw new Error('파일 다운로드 실패');
      }

      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const result = await downloadFile(base64Data, page.filename, 'image/png');
        
        if (result.success) {
          console.log('[DesktopCapture] 다운로드 완료:', result.path);
        } else {
          console.error('[DesktopCapture] 다운로드 실패:', result.error);
          setError(result.error || '다운로드에 실패했습니다.');
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('[DesktopCapture] 다운로드 오류:', error);
      setError(error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다.');
    }
  }, []);

  // 선택된 파일들 ZIP 다운로드
  const handleDownloadSelected = useCallback(async () => {
    if (selectedPages.length === 0) {
      setError('다운로드할 파일을 선택해주세요.');
      return;
    }

    try {
      console.log('[DesktopCapture] ZIP 다운로드 시작:', selectedPages.length, '개 파일');

      const response = await fetch('/api/download-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          selectedFiles: selectedPages,
          baseUrl: crawlResult?.baseUrl 
        })
      });

      if (!response.ok) {
        throw new Error('ZIP 다운로드 실패');
      }

      const blob = await response.blob();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const zipFilename = `screenflow-capture-${timestamp}.zip`;

      const result = await downloadZipFile(blob, zipFilename);
      
      if (result.success) {
        console.log('[DesktopCapture] ZIP 다운로드 완료:', result.path);
        setCurrentStep('complete');
      } else {
        console.error('[DesktopCapture] ZIP 다운로드 실패:', result.error);
        setError(result.error || 'ZIP 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('[DesktopCapture] ZIP 다운로드 오류:', error);
      setError(error instanceof Error ? error.message : 'ZIP 다운로드 중 오류가 발생했습니다.');
    }
  }, [selectedPages, crawlResult]);

  // 클립보드 복사
  const handleCopyToClipboard = useCallback(async (page: CrawledPage) => {
    try {
      const response = await fetch(`/api/download?filename=${encodeURIComponent(page.filename)}`);
      if (!response.ok) {
        throw new Error('파일 로드 실패');
      }

      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const success = await copyToClipboard(dataUrl, 'image');
        
        if (success) {
          console.log('[DesktopCapture] 클립보드 복사 완료');
          // TODO: 토스트 알림 추가
        } else {
          setError('클립보드 복사에 실패했습니다.');
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('[DesktopCapture] 클립보드 복사 오류:', error);
      setError(error instanceof Error ? error.message : '클립보드 복사 중 오류가 발생했습니다.');
    }
  }, []);

  // 페이지 선택/해제
  const togglePageSelection = useCallback((filename: string) => {
    setSelectedPages(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  }, []);

  // 전체 선택/해제
  const toggleSelectAll = useCallback(() => {
    if (!crawlResult) return;
    
    const successfulPages = crawlResult.crawledPages
      .filter(page => page.success)
      .map(page => page.filename);
    
    if (selectedPages.length === successfulPages.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(successfulPages);
    }
  }, [crawlResult, selectedPages]);

  // 새로 시작
  const handleRestart = useCallback(() => {
    setCurrentStep('input');
    setUrl('');
    setCrawlResult(null);
    setSelectedPages([]);
    setError(null);
    setIsLoading(false);
    
    if (pollingManager) {
      pollingManager.stop();
      setPollingManager(null);
    }
  }, [pollingManager]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  🖥️ ScreenFlow Desktop
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  로컬 스크린샷 캡처 및 자동화 도구
                </p>
              </div>
              <div className="flex items-center gap-4">
                {appInfo && (
                  <Badge variant="outline" className="text-xs">
                    v{appInfo.version} ({appInfo.platform})
                  </Badge>
                )}
                {ENVIRONMENT_CONFIG.isElectron && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openDownloadFolder}
                    className="flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    다운로드 폴더
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 환경 정보 */}
        {ENVIRONMENT_CONFIG.isElectron && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  데스크톱 환경
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  로컬 파일 저장
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  폴더 직접 열기
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 메인 콘텐츠 */}
        <Tabs value={currentStep} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="input" disabled={isLoading}>
              URL 입력
            </TabsTrigger>
            <TabsTrigger value="loading" disabled={!isLoading}>
              캡처 중
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!crawlResult}>
              미리보기
            </TabsTrigger>
            <TabsTrigger value="complete" disabled={currentStep !== 'complete'}>
              완료
            </TabsTrigger>
          </TabsList>

          {/* URL 입력 단계 */}
          <TabsContent value="input" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  자동 스크린샷 캡처
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">웹사이트 URL</label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && startAutoCapture()}
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                <Button
                  onClick={startAutoCapture}
                  disabled={!url.trim() || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      캡처 중...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      자동 캡처 시작
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 로딩 단계 */}
          <TabsContent value="loading" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
                  <div>
                    <h3 className="text-lg font-semibold">페이지를 캡처하고 있습니다...</h3>
                    <p className="text-gray-600">잠시만 기다려주세요.</p>
                  </div>
                  <Progress value={33} className="w-full" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 미리보기 단계 */}
          <TabsContent value="preview" className="space-y-4">
            {crawlResult && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>캡처 결과</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {selectedPages.length === crawlResult.crawledPages.filter(p => p.success).length 
                          ? '전체 해제' : '전체 선택'}
                      </Button>
                      <Button
                        onClick={handleDownloadSelected}
                        disabled={selectedPages.length === 0}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        선택된 파일 다운로드 ({selectedPages.length})
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>총 {crawlResult.totalPages}개 페이지</span>
                    <span className="text-green-600">성공 {crawlResult.successCount}개</span>
                    {crawlResult.failureCount > 0 && (
                      <span className="text-red-600">실패 {crawlResult.failureCount}개</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {crawlResult.crawledPages.map((page) => (
                        <Card key={page.filename} className={`${page.success ? 'border-green-200' : 'border-red-200'}`}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{page.title}</h4>
                                  <p className="text-xs text-gray-500 truncate">{page.url}</p>
                                </div>
                                {page.success && (
                                  <input
                                    type="checkbox"
                                    checked={selectedPages.includes(page.filename)}
                                    onChange={() => togglePageSelection(page.filename)}
                                    className="ml-2"
                                  />
                                )}
                              </div>

                              {page.thumbnail && (
                                <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                                  <img
                                    src={page.thumbnail}
                                    alt={page.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between">
                                <Badge variant={page.success ? "default" : "destructive"}>
                                  {page.success ? '성공' : '실패'}
                                </Badge>
                                {page.success && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownloadSingle(page)}
                                    >
                                      <Download className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyToClipboard(page)}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {page.error && (
                                <p className="text-xs text-red-600">{page.error}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 완료 단계 */}
          <TabsContent value="complete" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-xl font-semibold">다운로드 완료!</h3>
                    <p className="text-gray-600">선택한 파일들이 성공적으로 저장되었습니다.</p>
                  </div>
                  <div className="flex justify-center gap-4">
                    {ENVIRONMENT_CONFIG.isElectron && (
                      <Button
                        variant="outline"
                        onClick={openDownloadFolder}
                        className="flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4" />
                        다운로드 폴더 열기
                      </Button>
                    )}
                    <Button onClick={handleRestart}>
                      새로 시작
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
