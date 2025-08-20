"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Globe,
    Settings2,
    Download,
    Sparkles,
    Camera,
    Monitor,
    Image as ImageIcon,
    CheckCircle2,
    XCircle,
    Loader2,
    RotateCcw,
    Play,
    Link,
    Command,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/field";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  viewportWidth: number;
  waitAfterLoad: number;
}

interface CrawledPage {
  url: string;
  title: string;
  filename: string;
  order: number;
  depth: number;
  fullScreenshot: Buffer;
  thumbnail: string;
  success: boolean;
  error?: string;
}

interface ImagePreviewProps {
  src: string;
  alt: string;
  title: string;
  url: string;
}

function ImagePreview({ src, alt, title, url }: ImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    if (src) {
      // src가 이미 data: URL 형식인지 확인
      if (src.startsWith('data:image/')) {
        setImageSrc(src);
      } else {
        // base64 문자열만 있는 경우 data URL로 변환
        setImageSrc(`data:image/png;base64,${src}`);
      }
      setIsLoading(false);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [src]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    console.error(`[ImagePreview] 이미지 로드 실패: ${title}`);
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError || !src) {
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // URL 파싱 실패 시 원본 사용
      hostname = url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }

    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-600/20 to-gray-800/20 rounded flex flex-col items-center justify-center text-center p-2">
        <ImageIcon className="w-8 h-8 text-white/30 mb-2" />
        <span className="text-xs text-white/40">이미지를 불러올 수 없습니다</span>
        <span className="text-xs text-white/20 mt-1 truncate w-full" title={url}>
          {hostname}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        title={title}
        className={cn(
          "w-full h-full object-cover rounded transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
}

export function ScreencaptureStudio() {
    const [currentStep, setCurrentStep] = useState<'input' | 'crawling' | 'preview' | 'complete' | 'download'>('input');
    const [inputUrl, setInputUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [crawlProgress, setCrawlProgress] = useState({
        totalPages: 0,
        currentPage: 0,
        currentUrl: ''
    });
    const [crawledPages, setCrawledPages] = useState<CrawledPage[]>([]);
    const [selectedPages, setSelectedPages] = useState<string[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [inputFocused, setInputFocused] = useState(false);

    const [crawlOptions, setCrawlOptions] = useState<CrawlOptions>({
        maxDepth: 1,
        maxPages: 10,
        viewportWidth: 1440,
        waitAfterLoad: 2000,
    });

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // 자동 크롤링 시작
    const startAutoCrawling = async () => {
        if (!inputUrl.trim()) {
            setError('URL을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');
        setCurrentStep('crawling');

        try {
            console.log('[Frontend] 자동 크롤링 시작:', {
                url: inputUrl,
                options: crawlOptions
            });

            const response = await fetch('/api/auto-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: inputUrl,
                    options: crawlOptions
                })
            });

            const data = await response.json();

            if (data.sessionId) {
                setSessionId(data.sessionId);
                pollCrawlStatus(data.sessionId);
            } else {
                throw new Error(data.error || '크롤링 시작에 실패했습니다.');
            }
        } catch (error) {
            console.error('[Frontend] 크롤링 시작 오류:', error);
            setError(`크롤링 시작 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
            setCurrentStep('input');
            setIsLoading(false);
        }
    };

    // 크롤링 상태 폴링
    const pollCrawlStatus = async (sessionId: string) => {
        try {
            const response = await fetch(`/api/auto-capture?sessionId=${sessionId}`);
            const data = await response.json();

            console.log('[Frontend] 크롤링 상태:', data);

            if (data.status === 'completed' && data.crawledPages) {
                setCrawledPages(data.crawledPages);
                setCurrentStep('preview');
                setIsLoading(false);
                
                // 성공한 페이지들을 기본 선택
                const successfulPages = data.crawledPages
                    .filter((page: CrawledPage) => page.success)
                    .map((page: CrawledPage) => page.filename);
                setSelectedPages(successfulPages);
            } else if (data.status === 'failed') {
                setError(data.error || '크롤링에 실패했습니다.');
                setCurrentStep('input');
                setIsLoading(false);
            } else {
                // 진행 중
                setCrawlProgress({
                    totalPages: data.totalPages || 0,
                    currentPage: data.currentPage || 0,
                    currentUrl: data.currentUrl || ''
                });
                
                // 진행 중인 페이지들도 실시간 업데이트
                if (data.crawledPages && data.crawledPages.length > 0) {
                    setCrawledPages(data.crawledPages);
                }
                
                // 계속 폴링
                setTimeout(() => pollCrawlStatus(sessionId), 2000);
            }
        } catch (error) {
            console.error('[Frontend] 크롤링 상태 폴링 오류:', error);
            setError('크롤링 상태 확인 중 오류가 발생했습니다.');
            setCurrentStep('input');
            setIsLoading(false);
        }
    };

    // 페이지 선택/해제
    const togglePageSelection = (filename: string) => {
        setSelectedPages(prev => 
            prev.includes(filename) 
                ? prev.filter(f => f !== filename)
                : [...prev, filename]
        );
    };

    // 전체 선택/해제
    const toggleSelectAll = () => {
        const successfulPages = crawledPages
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
            link.download = `screencapture_${sessionId}.zip`;
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
        setError('');
        setSessionId(null);
        setCrawledPages([]);
        setSelectedPages([]);
        setCrawlProgress({ totalPages: 0, currentPage: 0, currentUrl: '' });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (inputUrl.trim()) {
                startAutoCrawling();
            }
        }
    };

    return (
        <div className="min-h-screen flex flex-col w-full items-center justify-center bg-black text-white p-6 relative overflow-hidden">
            {/* 배경 효과 - Figma 스타일 적용 */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
                
                {/* 추가 Figma 스타일 blur 효과 (크롤링 페이지에서만) */}
                {currentStep === 'crawling' && (
                    <>
                        <div className="absolute top-1/6 left-1/6 w-96 h-96 bg-violet-400/5 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-500" />
                        <div className="absolute bottom-1/6 left-2/3 w-96 h-96 bg-indigo-600/5 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-1200" />
                        <div className="absolute top-2/3 right-1/6 w-64 h-64 bg-fuchsia-600/5 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-800" />
                    </>
                )}
            </div>

            {/* 헤더 - Figma 스타일 적용 */}
            <motion.div 
                className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/[0.05]"
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ height: '69px' }}
            >
                <div className="flex items-center justify-between px-6 h-full max-w-[1280px] mx-auto">
                                                    <h1 className="text-[19.375px] font-bold text-white leading-7" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>Screencapture Studio</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-white/60 font-normal">가입하기</span>
                        <button className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
                            로그인
                        </button>
                    </div>
                </div>
            </motion.div>

            <div className="w-full max-w-4xl mx-auto relative mt-20">
                <motion.div 
                    className="relative z-10 space-y-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    {/* 메인 콘텐츠 */}
                    {currentStep === 'input' && (
                        <div className="text-center space-y-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="space-y-4"
                            >
                                <h1 className="text-[44px] font-bold tracking-tight leading-[48px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-1.2px' }}>
                                    레퍼런스 수집
                                </h1>
                                <h2 className="text-[44px] font-bold tracking-tight leading-[40px] text-white/80" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    이제 링크 한 줄로 끝.
                                </h2>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent max-w-md mx-auto"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                />
                                <motion.p 
                                    className="text-base text-white/50 max-w-lg mx-auto leading-7"
                                    style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    레퍼런스를 자동으로 수집하고, 공유하세요.
                                </motion.p>
                            </motion.div>

                            <motion.div 
                                className="relative backdrop-blur-2xl bg-white/[0.019] rounded-2xl border border-white/[0.05] shadow-2xl max-w-[672px] mx-auto"
                                initial={{ scale: 0.98 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1 }}
                            >
                                <div className="p-6">
                                    <div className="bg-[#1b1b1b] rounded-lg p-4 min-h-[97px] flex flex-col justify-between">
                                        <Textarea
                                            ref={textareaRef}
                                            value={inputUrl}
                                            onChange={(e) => {
                                                setInputUrl(e.target.value);
                                                adjustHeight();
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => setInputFocused(true)}
                                            onBlur={() => setInputFocused(false)}
                                            placeholder="시작할 웹페이지 URL을 입력하세요."
                                            containerClassName="w-full"
                                            className={cn(
                                                "w-full px-0 py-0",
                                                "resize-none",
                                                "bg-transparent",
                                                "border-none",
                                                "text-white/90 text-sm",
                                                "focus:outline-none",
                                                "placeholder:text-white/30",
                                                "min-h-[24px]"
                                            )}
                                            style={{
                                                overflow: "hidden",
                                            }}
                                            showRing={false}
                                        />
                                        
                                        <div className="flex justify-end mt-4">
                                            <motion.button
                                                type="button"
                                                onClick={startAutoCrawling}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                disabled={isLoading || !inputUrl.trim()}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                    "flex items-center gap-2",
                                                    inputUrl.trim()
                                                        ? "bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90"
                                                        : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                                                )}
                                            >
                                                <Play className="w-4 h-4" />
                                                시작
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>

                                {/* 설정 옵션 - Figma 스타일 적용 */}
                                <div className="px-6 pb-6">
                                    <div className="flex gap-3">
                                        {/* 크롤링 깊이 */}
                                        <div className="bg-[#1b1b1b] rounded-md px-3 py-2 flex items-center gap-2 min-w-[147px]">
                                            <select
                                                value={crawlOptions.maxDepth}
                                                onChange={(e) => setCrawlOptions(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
                                                className="bg-transparent text-white text-[11px] font-normal leading-4 border-none outline-none appearance-none pr-2"
                                                style={{ letterSpacing: '-0.11px' }}
                                            >
                                                <option value={0} className="bg-[#1b1b1b] text-white">메인 페이지만 (깊이 0)</option>
                                                <option value={1} className="bg-[#1b1b1b] text-white">메인 + 1단계 링크 (깊이 1)</option>
                                                <option value={2} className="bg-[#1b1b1b] text-white">메인 + 2단계 링크 (깊이 2)</option>
                                            </select>
                                            <svg className="w-2.5 h-2.5 text-white/60 flex-shrink-0" viewBox="0 0 10 10" fill="currentColor">
                                                <path d="M2.5 3.75L5 6.25L7.5 3.75"/>
                                            </svg>
                                        </div>
                                        
                                        {/* 최대 페이지 수 */}
                                        <div className="bg-[#1b1b1b] rounded-md px-3 py-2 flex items-center gap-2 min-w-[98px]">
                                            <select
                                                value={crawlOptions.maxPages}
                                                onChange={(e) => setCrawlOptions(prev => ({ ...prev, maxPages: parseInt(e.target.value) }))}
                                                className="bg-transparent text-white text-[11px] font-normal leading-4 border-none outline-none appearance-none pr-2"
                                                style={{ letterSpacing: '-0.11px' }}
                                            >
                                                <option value={5} className="bg-[#1b1b1b] text-white">최대 5개 캡쳐</option>
                                                <option value={10} className="bg-[#1b1b1b] text-white">최대 10개 캡쳐</option>
                                                <option value={15} className="bg-[#1b1b1b] text-white">최대 15개 캡쳐</option>
                                                <option value={20} className="bg-[#1b1b1b] text-white">최대 20개 캡쳐</option>
                                                <option value={30} className="bg-[#1b1b1b] text-white">최대 30개 캡쳐</option>
                                            </select>
                                            <svg className="w-2.5 h-2.5 text-white/60 flex-shrink-0" viewBox="0 0 10 10" fill="currentColor">
                                                <path d="M2.5 3.75L5 6.25L7.5 3.75"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {error && (
                                <motion.div 
                                    className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 max-w-2xl mx-auto"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {error}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* 크롤링 진행 중 - Figma 스타일 적용 */}
                    {currentStep === 'crawling' && (
                        <div className="text-center space-y-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <h2 className="text-[44px] font-bold leading-[40px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    알려주신 링크에 들어가서
                                </h2>
                                <h3 className="text-[44px] font-bold leading-[48px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-1.2px' }}>
                                    열심히 탐험하고 있어요
                                </h3>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent max-w-[448px] mx-auto"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                />
                                <p className="text-base text-white/50 max-w-lg mx-auto leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                    수집한 링크를 리스트로 모아서 보고드릴게요!
                                </p>
                            </motion.div>

                            <motion.div 
                                className="backdrop-blur-2xl bg-white/[0.019] rounded-2xl border border-white/[0.05] p-8 max-w-[672px] mx-auto"
                                initial={{ scale: 0.98 }}
                                animate={{ scale: 1 }}
                            >
                                {/* 슈퍼마리오 스타일 로딩 애니메이션 */}
                                <div className="flex justify-center mb-8">
                                    <motion.div 
                                        className="mario-loader"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2, duration: 0.5 }}
                                    />
                                </div>
                                
                                <div className="space-y-6">
                                    {/* 진행률 표시는 이제 Progress 컴포넌트 내부에서 처리 */}
                                    
                                    {crawlProgress.totalPages > 0 && (
                                        <div className="w-full space-y-2">
                                            {/* 진행률 텍스트 */}
                                            <div className="flex w-full justify-between mb-2">
                                                <span className="text-sm font-bold text-white leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                                    {crawlProgress.currentPage}/{crawlProgress.totalPages || '...'} 페이지 완료
                                                </span>
                                                <span className="text-sm font-bold text-white leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                                    {Math.round((crawlProgress.currentPage / crawlProgress.totalPages) * 100)}%
                                                </span>
                                            </div>
                                            
                                            {/* React Aria Progress 컴포넌트 - 데모 스타일 적용 */}
                                            <Progress 
                                                value={(crawlProgress.currentPage / crawlProgress.totalPages) * 100} 
                                                className="w-full"
                                                barClassName="!bg-gray-300 !h-2 !rounded-full overflow-hidden"
                                                fillClassName="!bg-indigo-500 !rounded-full transition-all duration-500"
                                            >
                                                {({ valueText }) => (
                                                    <div className="sr-only">
                                                        {valueText} 진행률
                                                    </div>
                                                )}
                                            </Progress>
                                            
                                            {/* Fallback Progress Bar (간단한 div 기반) */}
                                            <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden shadow-lg">
                                                <motion.div 
                                                    className="bg-indigo-500 h-full rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ 
                                                        width: `${(crawlProgress.currentPage / crawlProgress.totalPages) * 100}%` 
                                                    }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {crawlProgress.currentUrl && (
                                        <motion.div 
                                            className="bg-[#070608] rounded-lg p-3 flex items-center justify-center"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={crawlProgress.currentUrl}
                                        >
                                            <div className="text-sm font-bold text-white text-center leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                                정보의 바다를 탐험 중
                                            </div>
                                        </motion.div>
                                    )}
                                    
                                    {/* 재미있는 상태 메시지 - 숨김 처리 */}

                                    {/* 진행 중인 페이지 미리보기 */}
                                    {crawledPages.length > 0 && (
                                        <motion.div
                                            className="mt-8 p-6 bg-gradient-to-b from-purple-500/5 to-blue-500/5 rounded-xl border border-purple-500/20"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className="text-center mb-4">
                                                <h4 className="text-lg font-semibold text-white mb-2">
                                                    🎨 수집한 보드 미리보기
                                                </h4>
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-full">
                                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                                    <span className="text-sm text-purple-200">
                                                        {crawledPages.filter(p => p.success).length}개 수집 완료
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                                {crawledPages.slice(0, 12).map((page, index) => (
                                                    <motion.div
                                                        key={page.filename}
                                                        className="aspect-[4/3] relative group"
                                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ 
                                                            delay: index * 0.08,
                                                            type: "spring",
                                                            stiffness: 200,
                                                            damping: 20
                                                        }}
                                                    >
                                                        <div className="relative overflow-hidden rounded-lg">
                                                            {page.success ? (
                                                                <ImagePreview 
                                                                    src={page.thumbnail}
                                                                    alt={page.title}
                                                                    title={page.title}
                                                                    url={page.url}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full bg-red-500/20 rounded flex items-center justify-center">
                                                                    <XCircle className="w-4 h-4 text-red-400" />
                                                                </div>
                                                            )}
                                                            {/* 순서 배지 */}
                                                            <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow-lg">
                                                                {page.order}
                                                            </div>
                                                            {/* 호버 오버레이 */}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-lg"></div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                            {crawledPages.length > 12 && (
                                                <div className="text-center mt-4">
                                                    <span className="text-sm text-white/60">
                                                        그리고 {crawledPages.length - 12}개 더...
                                                    </span>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* 미리보기 및 선택 */}
                    {currentStep === 'preview' && (
                        <div className="space-y-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center space-y-4"
                            >
                                <h2 className="text-3xl md:text-4xl font-semibold">🎉 보드 완성!</h2>
                                <p className="text-lg text-white/70">
                                    총 {crawledPages.filter(p => p.success).length}개의 멋진 화면을 수집했어요
                                </p>
                                <p className="text-sm text-white/50">
                                    원하는 이미지들을 선택해서 다운로드하세요
                                </p>
                            </motion.div>

                            <motion.div 
                                className="backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-6"
                                initial={{ scale: 0.98 }}
                                animate={{ scale: 1 }}
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        {selectedPages.length === crawledPages.filter(p => p.success).length ? '전체 해제' : '전체 선택'}
                                    </button>
                                    <span className="text-sm text-white/60">
                                        {selectedPages.length}개 선택됨
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                                    {crawledPages.map((page, index) => (
                                        <motion.div
                                            key={page.filename}
                                            className={cn(
                                                "relative group cursor-pointer rounded-lg border-2 transition-all",
                                                page.success 
                                                    ? selectedPages.includes(page.filename)
                                                        ? "border-blue-500 bg-blue-500/10"
                                                        : "border-white/20 hover:border-white/40"
                                                    : "border-red-500/50 opacity-50"
                                            )}
                                            onClick={() => page.success && togglePageSelection(page.filename)}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            {page.success ? (
                                                <>
                                                    <div className="aspect-[4/3] p-2">
                                                        <ImagePreview 
                                                            src={page.thumbnail}
                                                            alt={page.title}
                                                            title={page.title}
                                                            url={page.url}
                                                        />
                                                    </div>
                                                    <div className="p-3 space-y-2">
                                                        <h3 className="text-sm font-medium truncate" title={page.title}>
                                                            {page.title}
                                                        </h3>
                                                        <p className="text-xs text-white/50 truncate" title={page.url}>
                                                            {page.url}
                                                        </p>
                                                    </div>
                                                    {selectedPages.includes(page.filename) && (
                                                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="aspect-[4/3] p-2 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                                        <p className="text-xs text-red-400">캡처 실패</p>
                                                        <p className="text-xs text-white/50 mt-1" title={page.error}>
                                                            {page.error?.substring(0, 30)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center">
                                    <motion.button
                                        onClick={startNew}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        다시 시작
                                    </motion.button>
                                    
                                    <motion.button
                                        onClick={handleDownload}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={selectedPages.length === 0}
                                        className={cn(
                                            "px-6 py-3 rounded-lg text-sm font-medium transition-all",
                                            "flex items-center gap-2",
                                            selectedPages.length > 0
                                                ? "bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90"
                                                : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                                        )}
                                    >
                                        <Download className="w-4 h-4" />
                                        다운로드 ({selectedPages.length}개)
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* 다운로드 완료 */}
                    {currentStep === 'download' && (
                        <div className="text-center space-y-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
                                <h2 className="text-3xl font-semibold">다운로드 완료!</h2>
                                <p className="text-white/60">
                                    {selectedPages.length}개의 스크린샷이 성공적으로 다운로드되었습니다.
                                </p>
                            </motion.div>

                            <motion.button
                                onClick={startNew}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors"
                            >
                                새로운 캡처 시작
                            </motion.button>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* 마우스 팔로우 효과 */}
            {inputFocused && (
                <motion.div 
                    className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.02] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]"
                    animate={{
                        x: mousePosition.x - 400,
                        y: mousePosition.y - 400,
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 150,
                        mass: 0.5,
                    }}
                />
            )}
        </div>
    );
}
