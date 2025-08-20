"use client";

import { Download, Globe, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlowCaptureOptions {
  maxDepth: number;
  maxElements: number;
  waitAfterClick: number;
  includeExternalLinks: boolean;
  onlyInternalNavigation: boolean;
}

interface UrlInputWithLoadingProps {
  id?: string;
  placeholder?: string;
  loadingDuration?: number;
  onSubmit?: (url: string) => void | Promise<void>;
  className?: string;
}

export function UrlInputWithLoading({
  id = "url-input-with-loading",
  placeholder = "웹사이트 URL을 입력하세요 (예: https://example.com)",
  loadingDuration = 5000,
  onSubmit,
  className
}: UrlInputWithLoadingProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({
    totalPages: 0,
    successCount: 0,
    failureCount: 0,
    maxDepthReached: 0,
    totalSteps: 0
  });
  
  // 플로우 캡처 옵션
  const [flowOptions, setFlowOptions] = useState<FlowCaptureOptions>({
    maxDepth: 2,
    maxElements: 10,
    waitAfterClick: 3000,
    includeExternalLinks: false,
    onlyInternalNavigation: true
  });

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || !isValidUrl(inputValue) || isLoading) return;
    
    setIsLoading(true);
    setIsCompleted(false);
    setSessionId(null);
    
    try {
      // 실제 API 호출
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: inputValue,
          options: flowOptions
        }),
      });
      
      if (!response.ok) {
        throw new Error('API 요청이 실패했습니다.');
      }
      
      const data = await response.json();
      setSessionId(data.sessionId);
      await onSubmit?.(inputValue);
      
      // 진행 상황 폴링 시작
      pollCaptureStatus(data.sessionId);
      
    } catch (error) {
      console.error("Error processing URL:", error);
      setIsLoading(false);
      alert('스크린샷 캡처 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const pollCaptureStatus = async (sessionId: string) => {
    const maxAttempts = 60; // 최대 5분 (5초마다 체크)
    let attempts = 0;

    const checkStatus = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/capture?sessionId=${sessionId}`);
        
        if (!response.ok) {
          throw new Error('상태 확인 실패');
        }
        
        const statusData = await response.json();
        
        // 진행 상황 업데이트
        if (statusData.totalPages !== undefined) {
          setCaptureProgress({
            totalPages: statusData.totalPages,
            successCount: statusData.successCount || 0,
            failureCount: statusData.failureCount || 0,
            maxDepthReached: statusData.maxDepthReached || 0,
            totalSteps: statusData.totalSteps || 0
          });
        }
        
        if (statusData.status === 'completed') {
          setIsLoading(false);
          setIsCompleted(true);
          return;
        }
        
        if (statusData.status === 'failed') {
          setIsLoading(false);
          alert(`캡처 실패: ${statusData.error || '알 수 없는 오류'}`);
          return;
        }
        
        // 아직 진행 중이면 다시 체크
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000); // 5초 후 다시 체크
        } else {
          setIsLoading(false);
          alert('캡처 시간이 초과되었습니다. 다시 시도해주세요.');
        }
        
      } catch (error) {
        console.error('Status polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        } else {
          setIsLoading(false);
          alert('상태 확인 중 오류가 발생했습니다.');
        }
      }
    };

    // 첫 번째 체크는 3초 후 시작 (캡처 시작 시간 확보)
    setTimeout(checkStatus, 3000);
  };

  const handleDownload = async () => {
    if (!sessionId) {
      alert('세션 ID가 없습니다. 다시 캡처를 시작해주세요.');
      return;
    }
    
    console.log(`[Frontend] Attempting download for sessionId: ${sessionId}`);
    
    try {
      // 먼저 디버그 API로 세션 존재 여부 확인
      const debugResponse = await fetch(`/api/debug?sessionId=${sessionId}`);
      const debugData = await debugResponse.json();
      console.log('[Frontend] Debug info:', debugData);
      
      if (!debugData.found) {
        alert(`세션을 찾을 수 없습니다. 세션 ID: ${sessionId}\n다시 캡처를 시작해주세요.`);
        return;
      }
      
      if (debugData.session?.status !== 'completed') {
        alert(`캡처가 아직 완료되지 않았습니다. 상태: ${debugData.session?.status}\n잠시 후 다시 시도해주세요.`);
        return;
      }
      
      // 실제 다운로드 요청
      console.log('[Frontend] Starting actual download...');
      const response = await fetch(`/api/download?sessionId=${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Frontend] Download failed:', errorData);
        
        throw new Error(`다운로드 실패 (${response.status}): ${errorData.error || '알 수 없는 오류'}`);
      }
      
      console.log('[Frontend] Download response received, creating blob...');
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('다운로드된 파일이 비어있습니다.');
      }
      
      console.log(`[Frontend] Blob created, size: ${blob.size} bytes`);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `screenshots_${sessionId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('[Frontend] Download completed successfully');
      
    } catch (error) {
      console.error('[Frontend] Download error:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`다운로드 중 오류가 발생했습니다:\n${errorMessage}\n\n다시 시도해주세요.`);
    }
  };

  const handleStartNew = () => {
    setInputValue("");
    setIsLoading(false);
    setIsCompleted(false);
    setSessionId(null);
    setCaptureProgress({
      totalPages: 0,
      successCount: 0,
      failureCount: 0,
      maxDepthReached: 0,
      totalSteps: 0
    });
  };

  return (
    <div className={cn("w-full max-w-2xl mx-auto py-8 space-y-6", className)}>
      {/* URL 입력 섹션 */}
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📸 Screenflow
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            웹사이트의 흐름을 자동으로 캡처하여 스크린샷을 생성합니다
          </p>
        </div>

        {/* 고급 옵션 */}
        <div className="border rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between p-2"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              <span>플로우 캡처 옵션</span>
            </div>
            <span className="text-xs text-gray-500">
              {showAdvanced ? '숨기기' : '설정'}
            </span>
          </Button>
          
          {showAdvanced && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    최대 탐색 깊이
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={flowOptions.maxDepth}
                    onChange={(e) => setFlowOptions(prev => ({
                      ...prev,
                      maxDepth: parseInt(e.target.value) || 1
                    }))}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">클릭 후 추가 탐색 단계 (1-5)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    최대 캡처 수
                  </label>
                  <Input
                    type="number"
                    min="5"
                    max="30"
                    value={flowOptions.maxElements}
                    onChange={(e) => setFlowOptions(prev => ({
                      ...prev,
                      maxElements: parseInt(e.target.value) || 5
                    }))}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">생성할 스크린샷 수 (5-30)</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  클릭 후 대기 시간 (ms)
                </label>
                <Input
                  type="number"
                  min="1000"
                  max="10000"
                  step="500"
                  value={flowOptions.waitAfterClick}
                  onChange={(e) => setFlowOptions(prev => ({
                    ...prev,
                    waitAfterClick: parseInt(e.target.value) || 3000
                  }))}
                  className="text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">페이지 변화 감지를 위한 대기 시간</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      내부 링크만 탐색
                    </span>
                    <p className="text-xs text-gray-500">동일 도메인 내의 링크만 클릭</p>
                  </div>
                  <Button
                    variant={flowOptions.onlyInternalNavigation ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFlowOptions(prev => ({
                      ...prev,
                      onlyInternalNavigation: !prev.onlyInternalNavigation
                    }))}
                  >
                    {flowOptions.onlyInternalNavigation ? 'ON' : 'OFF'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Globe className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            id={id}
            type="url"
            placeholder={placeholder}
            className={cn(
              "pl-10 pr-4 py-6 text-lg rounded-xl border-2",
              "focus:border-blue-500 focus:ring-blue-500",
              isLoading && "bg-gray-50 dark:bg-gray-800"
            )}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isLoading || isCompleted}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || !isValidUrl(inputValue) || isLoading || isCompleted}
          className="w-full py-6 text-lg rounded-xl"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              스크린샷 생성 중...
            </>
          ) : (
            "스크린샷 생성 시작"
          )}
        </Button>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                플로우 캡처 진행 중...
              </h3>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {captureProgress.totalPages > 0 
                  ? `${captureProgress.successCount}/${captureProgress.totalPages} 페이지 완료` 
                  : "클릭 가능한 요소를 찾고 플로우를 탐색하고 있습니다."
                }
              </p>
              <div className="mt-3 space-y-2">
                {captureProgress.totalPages > 0 && (
                  <div className="grid grid-cols-2 gap-4 text-sm text-blue-600 dark:text-blue-400">
                    <div>성공: {captureProgress.successCount} | 실패: {captureProgress.failureCount}</div>
                    <div>단계: {captureProgress.totalSteps} | 깊이: {captureProgress.maxDepthReached}</div>
                  </div>
                )}
                <div className="bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                    style={{ 
                      width: captureProgress.totalPages > 0 
                        ? `${(captureProgress.successCount + captureProgress.failureCount) / captureProgress.totalPages * 100}%`
                        : "30%" 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 완료 상태 */}
      {isCompleted && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto">
              <Download className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100">
                플로우 캡처 완료!
              </h3>
              <p className="text-green-700 dark:text-green-300 mt-1">
                {captureProgress.totalPages > 0 
                  ? `총 ${captureProgress.totalPages}개 페이지 중 ${captureProgress.successCount}개 성공적으로 캡처되었습니다.`
                  : "웹사이트의 플로우가 성공적으로 캡처되었습니다."
                }
              </p>
              {captureProgress.totalSteps > 0 && (
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                  📊 총 {captureProgress.totalSteps}단계 플로우를 {captureProgress.maxDepthReached}단계 깊이까지 탐색했습니다.
                </p>
              )}
              {captureProgress.failureCount > 0 && (
                <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">
                  ⚠️ {captureProgress.failureCount}개 페이지는 캡처하지 못했습니다.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleDownload}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                ZIP 파일 다운로드
              </Button>
              <Button
                onClick={handleStartNew}
                variant="outline"
                className="px-6 py-3"
                size="lg"
              >
                새로 시작하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 안내 텍스트 */}
      {!isLoading && !isCompleted && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>
            💡 <strong>팁:</strong> 최대 10개의 내부 페이지를 자동으로 캡처합니다
          </p>
          <div className="flex justify-center space-x-6 text-xs">
            <span>✅ 내부 링크 자동 탐색</span>
            <span>✅ 전체 페이지 스크린샷</span>
            <span>✅ ZIP 파일로 정리</span>
          </div>
        </div>
      )}
    </div>
  );
}
