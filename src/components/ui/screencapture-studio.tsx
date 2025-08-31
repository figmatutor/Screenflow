"use client";

import { useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
    Copy,
    Archive,
    Tag,
    ExternalLink,
    MousePointer,
    Bookmark,
    Menu,
    X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/field";
import { BeamsBackground } from "@/components/ui/beams-background";

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
    <div className="relative w-full flex items-center justify-center" style={{ minHeight: 'fit-content' }}>
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        title={title}
        className={cn(
          "w-full h-auto object-contain rounded transition-opacity duration-300",
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
    // 인증 상태 관리
    const { user, loading, signOut, isAuthenticated } = useAuth();
    
    // 성능 최적화: 모바일 및 저성능 디바이스 감지
    const isMobile = useMemo(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        return false;
    }, []);

    // 성능 최적화: reduced motion 감지
    const prefersReducedMotion = useMemo(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        return false;
    }, []);

    // 최적화된 애니메이션 설정
    const optimizedAnimationConfig = useMemo(() => ({
        duration: isMobile || prefersReducedMotion ? 0.3 : 0.8,
        ease: "easeOut",
        delay: isMobile ? 0 : 0.15
    }), [isMobile, prefersReducedMotion]);

    // 스크롤 상태 관리
    const [isScrolled, setIsScrolled] = useState(false);
    
    // 모바일 메뉴 상태 관리  
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // 스크롤 이벤트 리스너
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            setIsScrolled(scrollTop > 50);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
    
    // 새로운 기능들을 위한 상태
    const [flowCaptures, setFlowCaptures] = useState<any[]>([]);
    const [isFlowCapturing, setIsFlowCapturing] = useState(false);
    const [recommendedSites, setRecommendedSites] = useState<any[]>([]);
    const [showRecommendations, setShowRecommendations] = useState(false);
    // 캡처 모드 통합 - 플로우 캡처만 사용
    const [selectedFlowCaptures, setSelectedFlowCaptures] = useState<string[]>([]);
    const [showTagModal, setShowTagModal] = useState(false);
    const [currentImageForArchive, setCurrentImageForArchive] = useState<{screenshot: string, title: string, url: string} | null>(null);

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

    // 플로우 캡처 함수
    // URL 정규화 및 유효성 검사 함수
    const normalizeAndValidateUrl = (url: string): string => {
        let normalizedUrl = url.trim();
        
        // 프로토콜이 없으면 https:// 추가
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = 'https://' + normalizedUrl;
        }
        
        // URL 유효성 검사
        try {
            const urlObj = new URL(normalizedUrl);
            return urlObj.toString();
        } catch (error) {
            throw new Error(`잘못된 URL 형식입니다: ${url}`);
        }
    };

    const startFlowCapture = async () => {
        if (!inputUrl) {
            setError('URL을 입력해주세요.');
            return;
        }

        // URL 정규화 및 유효성 검사
        let normalizedUrl: string;
        try {
            normalizedUrl = normalizeAndValidateUrl(inputUrl);
            console.log('[Flow Capture] URL 정규화:', inputUrl, '→', normalizedUrl);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'URL 형식이 올바르지 않습니다.');
            return;
        }

        setIsFlowCapturing(true);
        setError('');

        try {
            console.log('[Flow Capture] 시작:', normalizedUrl);
            
            const response = await fetch('/api/flow-capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: normalizedUrl,
                    maxSteps: 5,
                    triggerKeywords: ['다음', '시작', 'Next', 'Start', 'Continue', '계속', '진행', '다음단계'],
                    waitTime: 3000
                }),
            });

            const data = await response.json();

            if (data.success) {
                setFlowCaptures(data.screenshots);
                setCurrentStep('preview');
                console.log('[Flow Capture] 성공:', data.screenshots.length, '개 캡처');
            } else {
                throw new Error(data.error || '플로우 캡처에 실패했습니다.');
            }
        } catch (error) {
            console.error('[Flow Capture] 오류:', error);
            setError(error instanceof Error ? error.message : '플로우 캡처 중 오류가 발생했습니다.');
        } finally {
            setIsFlowCapturing(false);
        }
    };

    // 사이트 추천 함수
    const loadRecommendations = async (url: string) => {
        try {
            // URL 정규화
            let normalizedUrl: string;
            try {
                normalizedUrl = normalizeAndValidateUrl(url);
                console.log('[Recommendations] URL 정규화:', url, '→', normalizedUrl);
            } catch (error) {
                console.warn('[Recommendations] URL 정규화 실패:', error);
                return; // 유효하지 않은 URL은 추천하지 않음
            }
            
            console.log('[Recommendations] 로딩 시작:', normalizedUrl);
            
            const response = await fetch('/api/recommend-sites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: normalizedUrl }),
            });

            const data = await response.json();

            if (data.success) {
                setRecommendedSites(data.recommendations);
                setShowRecommendations(true);
                console.log('[Recommendations] 성공:', data.recommendations.length, '개 추천');
            } else {
                console.warn('[Recommendations] 실패:', data.error);
            }
        } catch (error) {
            console.error('[Recommendations] 오류:', error);
        }
    };

    // 클립보드 복사 함수 (오류 수정)
    const copyToClipboard = async (screenshot: string) => {
        try {
            // ClipboardAPI 지원 여부 확인
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error('브라우저에서 클립보드 API를 지원하지 않습니다.');
            }

            // base64 문자열을 blob으로 변환
            const base64Response = await fetch(`data:image/png;base64,${screenshot}`);
            if (!base64Response.ok) {
                throw new Error('이미지 데이터 변환에 실패했습니다.');
            }
            
            const blob = await base64Response.blob();
            
            // 클립보드에 쓰기
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
            alert('클립보드에 복사되었습니다! Figma에 붙여넣기(Ctrl+V) 하세요.');
        } catch (error) {
            console.error('클립보드 복사 오류:', error);
            
            // 대체 방법: 링크를 통한 다운로드
            try {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${screenshot}`;
                link.download = `screenshot_${Date.now()}.png`;
                link.click();
                alert('클립보드 복사가 지원되지 않아 이미지를 다운로드했습니다.');
            } catch (downloadError) {
                console.error('다운로드 대체 방법도 실패:', downloadError);
                alert('클립보드 복사와 다운로드 모두 실패했습니다.');
            }
        }
    };

    // 아카이브 저장 함수 (개별) - 태그 모달을 위해 수정
    const saveToArchive = async (screenshot: string, title: string, url: string, tags: string[] = ['캡처', 'UI', '레퍼런스']) => {
        try {
            const response = await fetch('/api/archive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    title,
                    screenshot,
                    tags,
                    category: '기타'
                }),
            });

            const data = await response.json();

            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || '저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('아카이브 저장 오류:', error);
            return false;
        }
    };

    // 개별 아카이브 저장 (태그 모달 띄우기)
    const saveIndividualToArchive = (screenshot: string, title: string, url: string) => {
        setCurrentImageForArchive({ screenshot, title, url });
        setShowTagModal(true);
    };

    // 다중 선택 관련 함수들
    const toggleFlowSelection = (index: number) => {
        setSelectedFlowCaptures(prev => 
            prev.includes(index.toString()) 
                ? prev.filter(id => id !== index.toString())
                : [...prev, index.toString()]
        );
    };

    const selectAllFlowCaptures = () => {
        if (selectedFlowCaptures.length === flowCaptures.length) {
            setSelectedFlowCaptures([]);
        } else {
            setSelectedFlowCaptures(flowCaptures.map((_, index) => index.toString()));
        }
    };

    // 선택된 이미지들 일괄 다운로드
    const downloadSelectedImages = () => {
        if (selectedFlowCaptures.length === 0) {
            alert('다운로드할 이미지를 선택해주세요.');
            return;
        }

        selectedFlowCaptures.forEach((selectedIndex, downloadIndex) => {
            const capture = flowCaptures[parseInt(selectedIndex)];
            if (capture) {
                setTimeout(() => {
                    const screenshot = capture.buffer || capture.screenshot;
                    if (screenshot) {
                        const link = document.createElement('a');
                        link.href = `data:image/png;base64,${screenshot}`;
                        link.download = `flow_capture_${capture.step}_${capture.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                        link.click();
                    }
                }, downloadIndex * 100); // 100ms 간격으로 다운로드
            }
        });
        
        alert(`${selectedFlowCaptures.length}개의 이미지를 다운로드합니다.`);
    };

    // 선택된 이미지들 일괄 클립보드 복사 (첫 번째만)
    const copySelectedToClipboard = async () => {
        if (selectedFlowCaptures.length === 0) {
            alert('복사할 이미지를 선택해주세요.');
            return;
        }

        const firstSelected = flowCaptures[parseInt(selectedFlowCaptures[0])];
        if (firstSelected) {
            // flow capture의 경우 buffer 속성 사용
            const screenshot = firstSelected.buffer || firstSelected.screenshot;
            if (screenshot) {
                await copyToClipboard(screenshot);
            } else {
                alert('이미지 데이터를 찾을 수 없습니다.');
            }
        } else {
            alert('선택된 이미지를 찾을 수 없습니다.');
        }
    };

    // 선택된 이미지들 일괄 아카이브 (태그 입력 모달 표시)
    const saveSelectedToArchive = () => {
        if (selectedFlowCaptures.length === 0) {
            alert('아카이브에 저장할 이미지를 선택해주세요.');
            return;
        }
        setCurrentImageForArchive(null); // 다중 선택 모드
        setShowTagModal(true);
    };

    // 태그와 함께 일괄 아카이브 저장
    const bulkSaveToArchive = async (tags: string[]) => {
        if (currentImageForArchive) {
            // 개별 저장
            const success = await saveToArchive(
                currentImageForArchive.screenshot,
                currentImageForArchive.title,
                currentImageForArchive.url,
                tags
            );
            if (success) {
                alert('아카이브에 저장되었습니다!');
            } else {
                alert('아카이브 저장에 실패했습니다.');
            }
        } else {
            // 일괄 저장
            let successCount = 0;
            
            for (const selectedIndex of selectedFlowCaptures) {
                const capture = flowCaptures[parseInt(selectedIndex)];
                if (capture) {
                    const screenshot = capture.buffer || capture.screenshot;
                    if (screenshot) {
                        const success = await saveToArchive(
                            screenshot, 
                            capture.title, 
                            capture.url, 
                            tags
                        );
                        if (success) successCount++;
                    }
                }
            }

            alert(`${successCount}개의 이미지가 아카이브에 저장되었습니다.`);
            setSelectedFlowCaptures([]);
        }
        
        setShowTagModal(false);
        setCurrentImageForArchive(null);
    };

    // URL 입력 시 추천 사이트 로딩
    useEffect(() => {
        if (inputUrl && inputUrl.includes('.')) {
            const timeoutId = setTimeout(() => {
                loadRecommendations(inputUrl);
            }, 1000);
            return () => clearTimeout(timeoutId);
        } else {
            setShowRecommendations(false);
            setRecommendedSites([]);
        }
    }, [inputUrl]);

    // 자동 크롤링 시작
    const startAutoCrawling = async () => {
        if (!inputUrl.trim()) {
            setError('URL을 입력해주세요.');
            return;
        }

        // URL 정규화 및 유효성 검사
        let normalizedUrl: string;
        try {
            normalizedUrl = normalizeAndValidateUrl(inputUrl);
            console.log('[Auto Capture] URL 정규화:', inputUrl, '→', normalizedUrl);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'URL 형식이 올바르지 않습니다.');
            return;
        }

        setIsLoading(true);
        setError('');
        setCurrentStep('crawling');

        try {
            console.log('[Frontend] 자동 크롤링 시작:', {
                url: normalizedUrl,
                options: crawlOptions
            });

            const response = await fetch('/api/auto-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: normalizedUrl,
                    options: crawlOptions
                })
            });

            // 안전한 JSON 파싱
            let data;
            try {
                const text = await response.text();
                console.log("[Frontend] 서버 응답:", text);
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("[Frontend] JSON 파싱 에러:", parseError);
                throw new Error("서버 응답 형식이 올바르지 않습니다.");
            }

            if (!response.ok) {
                throw new Error(data.error || `서버 에러: ${response.status}`);
            }
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
            console.log(`[Frontend] 폴링 요청: /api/auto-capture?sessionId=${sessionId}&v=2`);
            const response = await fetch(`/api/auto-capture?sessionId=${sessionId}&v=2`);
            // 안전한 JSON 파싱
            let data;
            try {
                const text = await response.text();
                console.log("[Frontend] 서버 응답:", text);
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("[Frontend] JSON 파싱 에러:", parseError);
                throw new Error("서버 응답 형식이 올바르지 않습니다.");
            }

            if (!response.ok) {
                throw new Error(data.error || `서버 에러: ${response.status}`);
            }
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
        <BeamsBackground 
            intensity="subtle" 
            className="min-h-screen bg-black transform-gpu"
        >
            <div className="min-h-screen flex flex-col w-full items-center justify-center text-white p-4 md:p-6 relative optimize-scroll">
            {/* 배경 효과 - BeamsBackground와 조화롭게 조정 */}
            <div className="absolute inset-0 w-full h-full overflow-hidden opacity-40">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/15 rounded-full mix-blend-screen filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full mix-blend-screen filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/15 rounded-full mix-blend-screen filter blur-[96px] animate-pulse delay-1000" />
                
                {/* 크롤링 중 추가 효과 - BeamsBackground와 조화 */}
                {currentStep === 'crawling' && (
                    <>
                        <div className="absolute top-1/6 left-1/6 w-96 h-96 bg-violet-400/10 rounded-full mix-blend-plus-lighter filter blur-[128px] animate-pulse delay-500" />
                        <div className="absolute bottom-1/6 left-2/3 w-96 h-96 bg-indigo-600/10 rounded-full mix-blend-plus-lighter filter blur-[128px] animate-pulse delay-1200" />
                        <div className="absolute top-2/3 right-1/6 w-64 h-64 bg-fuchsia-600/10 rounded-full mix-blend-plus-lighter filter blur-[96px] animate-pulse delay-800" />
                    </>
                )}
            </div>

            {/* 헤더 - 스크롤 상태에 따른 동적 스타일 적용 */}
            <motion.div 
                className={`header-fixed transition-all duration-300 ease-out ${
                    isScrolled ? 'header-scrolled' : 'header-transparent'
                }`}
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ 
                    height: '69px',
                    zIndex: 9999, // 인라인 스타일로도 z-index 확실히 설정
                    position: 'fixed' // position도 확실히 설정
                }}
            >
                <div className="flex items-center justify-between px-4 sm:px-6 h-full max-w-[calc(100%-2rem)] sm:max-w-[1280px] mx-auto">
                    <div className="flex items-center gap-14">
                        <a 
                            href="/" 
                            className="text-[19.375px] font-bold text-white leading-7 hover:text-white/80 transition-colors cursor-pointer" 
                            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                        >
                            ScreenFlow
                        </a>
                        
                        {/* 데스크탑 네비게이션 메뉴 */}
                        <div className="hidden min-[500px]:flex items-center gap-6">
                            <a 
                                href="/archive" 
                                className="text-sm text-white hover:text-white/80 transition-colors font-normal"
                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                            >
                                아카이브
                            </a>
                            <span className="text-sm text-white hover:text-white/80 transition-colors font-normal cursor-pointer">
                                내 프로필
                            </span>
                        </div>
                    </div>
                    
                    {/* 데스크탑 인증 버튼 */}
                    {!loading && (
                        <div className="hidden min-[500px]:flex items-center gap-4">
                            {isAuthenticated ? (
                                <>
                                    <span className="text-sm text-white/80 font-normal">
                                        {user?.email}
                                    </span>
                                    <button 
                                        onClick={signOut}
                                        className="text-sm text-white/60 hover:text-white/80 font-normal transition-colors"
                                    >
                                        로그아웃
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => window.location.href = '/login'}
                                        className="text-sm text-white/60 hover:text-white/80 font-normal transition-colors"
                                    >
                                        로그인
                                    </button>
                                    <button 
                                        onClick={() => window.location.href = '/register'}
                                        className="px-4 py-2 bg-white text-[#000000] rounded-lg text-sm font-bold hover:bg-white/90 transition-colors"
                                        style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                    >
                                        무료로 시작하기
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    
                    {/* 모바일 햄버거 메뉴 버튼 */}
                    <button 
                        className="min-[500px]:hidden p-2 text-white hover:text-white/80 transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="메뉴 열기"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </motion.div>
            
            {/* 모바일 드롭다운 메뉴 */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        className="fixed top-[69px] left-0 right-0 bg-black/95 backdrop-blur-lg border-b border-white/10 z-40 min-[500px]:hidden"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 py-6 space-y-4">
                            <a 
                                href="/archive" 
                                className="block text-white hover:text-white/80 transition-colors font-normal text-center py-3"
                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                아카이브
                            </a>
                            <div className="border-t border-white/10"></div>
                            <span 
                                className="block text-white hover:text-white/80 transition-colors font-normal cursor-pointer text-center py-3"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                내 프로필
                            </span>
                            <div className="border-t border-white/10"></div>
                            {!loading && (
                                <div className="flex flex-col gap-3 pt-2">
                                    {isAuthenticated ? (
                                        <>
                                            <span className="text-sm text-white/80 font-normal text-center">
                                                {user?.email}
                                            </span>
                                            <button 
                                                className="text-sm text-white/60 hover:text-white/80 font-normal text-center transition-colors"
                                                onClick={() => {
                                                    setIsMobileMenuOpen(false);
                                                    signOut();
                                                }}
                                            >
                                                로그아웃
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                className="text-sm text-white/60 hover:text-white/80 font-normal text-center transition-colors"
                                                onClick={() => {
                                                    setIsMobileMenuOpen(false);
                                                    window.location.href = '/login';
                                                }}
                                            >
                                                로그인
                                            </button>
                                            <button 
                                                className="w-full px-4 py-3 bg-white text-[#000000] rounded-lg text-sm font-bold hover:bg-white/90 transition-colors"
                                                style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                                onClick={() => {
                                                    setIsMobileMenuOpen(false);
                                                    window.location.href = '/register';
                                                }}
                                            >
                                                무료로 시작하기
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div id="capture-section" className="w-full max-w-[calc(100%-2rem)] sm:max-w-6xl mx-auto relative mt-[69px] md:mt-[210px] px-4 md:px-6">
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
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold tracking-tight leading-[32px] md:leading-[40px] lg:leading-[48px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-1.2px' }}>
                                    레퍼런스 수집
                                </h2>
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold tracking-tight leading-[32px] md:leading-[40px] lg:leading-[48px] text-white/80 mt-1 md:mt-2" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    이제 링크 한 줄로 끝.
                                </h2>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent max-w-md mx-auto"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                />
                                <motion.p 
                                    className="text-[14px] md:text-[16px] lg:text-[16px] text-white/50 max-w-lg mx-auto leading-7"
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
                                        
                                        {/* 시작 버튼 - Figma 스타일 */}
                                        <div className="flex justify-end mt-4">
                                            <motion.button
                                                type="button"
                                                onClick={startFlowCapture}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                disabled={isFlowCapturing || !inputUrl.trim()}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                    "flex items-center gap-2",
                                                    inputUrl.trim()
                                                        ? "bg-white text-[#121212] shadow-lg shadow-white/10 hover:bg-white/90"
                                                        : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                                                )}
                                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                            >
                                                {isFlowCapturing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                                시작
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>

                                {/* 추천 사이트 섹션 */}
                                {showRecommendations && recommendedSites.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="px-6 pb-4 border-t border-gray-800"
                                    >
                                        <div className="pt-4">
                                            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-purple-400" />
                                                유사한 사이트 추천
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {recommendedSites.map((site, index) => (
                                                    <motion.button
                                                        key={index}
                                                        onClick={() => setInputUrl(site.url)}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-xs transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <ExternalLink className="w-3 h-3 text-purple-400" />
                                                            <span className="text-white/80 group-hover:text-white">
                                                                {site.title}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1 mt-1">
                                                            {site.tags.slice(0, 2).map((tag: string, tagIndex: number) => (
                                                                <span
                                                                    key={tagIndex}
                                                                    className="bg-purple-900/30 text-purple-300 px-1 py-0.5 rounded text-xs"
                                                                >
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

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

                            {/* 섹션 간 여백 150px */}
                            <div className="h-[150px]" />

                            {/* 3단계 프로세스 섹션 - 패럴랙스 효과 + 모노톤 디자인 */}
                        <motion.div 
                            className="space-y-8 max-w-6xl mx-auto relative will-change-transform transform-gpu"
                            initial={{ opacity: 0, y: isMobile ? 20 : 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ 
                                once: isMobile || prefersReducedMotion, 
                                margin: "-100px", 
                                amount: isMobile ? 0.2 : 0.3 
                            }}
                            transition={optimizedAnimationConfig}
                        >
                            {/* 섹션 타이틀 - 패럴랙스 효과 */}
                            <motion.div 
                                className="text-center space-y-4 will-change-transform"
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, margin: "-50px", amount: 0.5 }}
                                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                            >
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold tracking-tight leading-[32px] md:leading-[40px] lg:leading-[48px] text-white/80" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    번거로운 웹 레퍼런스 캡쳐
                                </h2>
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[32px] md:leading-[40px] lg:leading-[48px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40 mt-1 md:mt-2" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    딱 3단계로 완성.
                                </h2>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent max-w-md mx-auto"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.8, duration: 0.8 }}
                                />
                                <motion.p 
                                    className="text-[14px] md:text-[16px] lg:text-[16px] text-white/50 max-w-lg mx-auto leading-7"
                                    style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.9 }}
                                >
                                    복잡한 설정이나 다운로드 없이 링크 넣고 필요한 부분만 바로 다운로드.
                                </motion.p>
                            </motion.div>

                            {/* 3단계 카드 그리드 - 모노톤 디자인 + 패럴랙스 */}
                            <motion.div 
                                className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, margin: "-80px" }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                            >
                                {/* Card 1 - 개별 패럴랙스 효과 */}
                                <motion.div 
                                    className="relative backdrop-blur-2xl bg-white/[0.019] rounded-2xl border border-white/[0.05] shadow-2xl p-6 text-center will-change-transform"
                                    initial={{ 
                                        opacity: 0, 
                                        y: isMobile ? 15 : 30, 
                                        scale: isMobile ? 1 : 0.95 
                                    }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ 
                                        once: isMobile || prefersReducedMotion, 
                                        margin: "-50px",
                                        amount: 0.4
                                    }}
                                    transition={{ 
                                        duration: optimizedAnimationConfig.duration, 
                                        delay: isMobile ? 0 : 0.05, 
                                        type: isMobile ? "tween" : "spring", 
                                        stiffness: 100,
                                        ease: optimizedAnimationConfig.ease
                                    }}
                                    whileHover={!isMobile && !prefersReducedMotion ? { 
                                        scale: 1.02, 
                                        borderColor: "rgba(255,255,255,0.1)", 
                                        transition: { duration: 0.2 } 
                                    } : {}}
                                >
                                    <div className="mb-6">
                                        <div className="w-12 h-12 rounded-full bg-white/[0.08] border border-white/[0.15] flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                            <Link className="w-6 h-6 text-white/70" />
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        URL 입력 & 플로우 탐색
                                    </h3>
                                    <p className="text-[14px] md:text-[16px] lg:text-[16px] text-white/60 leading-6" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        분석하고 싶은 URL을 입력하면<br />
                                        사이트 구조를 파악합니다.
                                    </p>
                                </motion.div>

                                {/* Card 2 - 개별 패럴랙스 효과 */}
                                <motion.div 
                                    className="relative backdrop-blur-2xl bg-white/[0.019] rounded-2xl border border-white/[0.05] shadow-2xl p-6 text-center will-change-transform"
                                    initial={{ 
                                        opacity: 0, 
                                        y: isMobile ? 15 : 30, 
                                        scale: isMobile ? 1 : 0.95 
                                    }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ 
                                        once: isMobile || prefersReducedMotion, 
                                        margin: "-50px",
                                        amount: 0.4
                                    }}
                                    transition={{ 
                                        duration: optimizedAnimationConfig.duration, 
                                        delay: isMobile ? 0 : 0.1, 
                                        type: isMobile ? "tween" : "spring", 
                                        stiffness: 100,
                                        ease: optimizedAnimationConfig.ease
                                    }}
                                    whileHover={!isMobile && !prefersReducedMotion ? { 
                                        scale: 1.02, 
                                        borderColor: "rgba(255,255,255,0.1)", 
                                        transition: { duration: 0.2 } 
                                    } : {}}
                                >
                                    <div className="mb-6">
                                        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.12] flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                            <Camera className="w-6 h-6 text-white/60" />
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        자동 스크린샷 캡쳐
                                    </h3>
                                    <p className="text-[14px] md:text-[16px] lg:text-[16px] text-white/60 leading-6" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        탐색한 플로우는<br />
                                        실시간으로 캡쳐됩니다.
                                    </p>
                                </motion.div>

                                {/* Card 3 - 개별 패럴랙스 효과 */}
                                <motion.div 
                                    className="relative backdrop-blur-2xl bg-white/[0.019] rounded-2xl border border-white/[0.05] shadow-2xl p-6 text-center will-change-transform"
                                    initial={{ 
                                        opacity: 0, 
                                        y: isMobile ? 15 : 30, 
                                        scale: isMobile ? 1 : 0.95 
                                    }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ 
                                        once: isMobile || prefersReducedMotion, 
                                        margin: "-50px",
                                        amount: 0.4
                                    }}
                                    transition={{ 
                                        duration: optimizedAnimationConfig.duration, 
                                        delay: isMobile ? 0 : 0.15, 
                                        type: isMobile ? "tween" : "spring", 
                                        stiffness: 100,
                                        ease: optimizedAnimationConfig.ease
                                    }}
                                    whileHover={!isMobile && !prefersReducedMotion ? { 
                                        scale: 1.02, 
                                        borderColor: "rgba(255,255,255,0.1)", 
                                        transition: { duration: 0.2 } 
                                    } : {}}
                                >
                                    <div className="mb-6">
                                        <div className="w-12 h-12 rounded-full bg-white/[0.10] border border-white/[0.18] flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                            <Download className="w-6 h-6 text-white/80" />
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        스크린샷 저장
                                    </h3>
                                    <p className="text-[14px] md:text-[16px] lg:text-[16px] text-white/60 leading-6" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                        캡쳐한 이미지는 다운로드<br />
                                        또는 피그마로 가져가세요.
                                    </p>
                                </motion.div>
                            </motion.div>
                        </motion.div>

                        {/* 3단계 섹션 하단 여백 240px (120px + 추가 120px) */}
                        <div className="h-[240px]" />

                        {/* CTA 섹션 - 패럴랙스 효과 */}
                        <motion.div 
                            className="space-y-8 max-w-4xl mx-auto text-center relative"
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                        >
                            {/* CTA 메인 타이틀 */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: 0.15 }}
                            >
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold tracking-tight leading-[32px] md:leading-[40px] lg:leading-[48px] text-white mb-4" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    지금 바로 시작해보세요
                                </h2>
                                <p className="text-[14px] md:text-[16px] lg:text-[16px] text-white/70 leading-6 mb-8" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                    복잡한 설정 없이 링크 하나로 웹 레퍼런스를 수집하세요
                                </p>
                            </motion.div>

                            {/* CTA 버튼 - 메인만 유지 */}
                            <motion.div 
                                className="flex justify-center"
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: 0.25 }}
                            >
                                {/* 메인 CTA 버튼만 유지 */}
                                {!loading && (
                                    <motion.button
                                        onClick={() => {
                                            if (isAuthenticated) {
                                                // 로그인된 사용자는 캡처 섹션으로 스크롤
                                                document.getElementById('capture-section')?.scrollIntoView({ behavior: 'smooth' });
                                            } else {
                                                window.location.href = '/register';
                                            }
                                        }}
                                        className="px-8 py-4 bg-white text-black rounded-xl font-semibold hover:bg-white/90 transition-all duration-300 shadow-lg"
                                        whileHover={{ scale: 1.05, boxShadow: "0 10px 40px rgba(255,255,255,0.1)" }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                    >
                                        {isAuthenticated ? '캡처 시작하기' : '무료로 시작하기'}
                                    </motion.button>
                                )}
                            </motion.div>
                        </motion.div>

                            {/* CTA 섹션 하단 여백 400px */}
                            <div className="h-[400px]" />
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
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[32px] md:leading-[36px] lg:leading-[40px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-0.9px' }}>
                                    알려주신 링크에 들어가서
                                </h2>
                                <h3 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[32px] md:leading-[40px] lg:leading-[48px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/40" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: '-1.2px' }}>
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
                                    {/* 크롤링 시작 시 0% 표시 */}
                                    <div className="text-center">
                                        <motion.div 
                                            className="text-6xl font-black text-white mb-2 tabular-nums"
                                            style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            key={crawlProgress.totalPages > 0 ? Math.round((crawlProgress.currentPage / crawlProgress.totalPages) * 100) : 0}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                        >
                                            {crawlProgress.totalPages > 0 
                                                ? Math.round((crawlProgress.currentPage / crawlProgress.totalPages) * 100) 
                                                : 0}%
                                        </motion.div>
                                        <div className="text-base text-white/70" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                            {crawlProgress.totalPages > 0 
                                                ? `${crawlProgress.currentPage}/${crawlProgress.totalPages} 페이지 완료`
                                                : '크롤링 준비 중...'}
                                        </div>
                                    </div>
                                    
                                    {/* 진행률 표시는 이제 Progress 컴포넌트 내부에서 처리 */}
                                    
                                    {crawlProgress.totalPages > 0 && (
                                        <div className="w-full space-y-4">
                                            {/* 진행률 텍스트 */}
                                            <div className="flex w-full justify-between mb-2">
                                                <span className="text-sm font-medium text-white/60 leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                                    진행 상황
                                                </span>
                                                <span className="text-sm font-bold text-white leading-7" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                                                    {crawlProgress.currentPage}/{crawlProgress.totalPages || '...'} 완료
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
                                                        className="relative group"
                                                        style={{ minHeight: 'fit-content' }}
                                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ 
                                                            delay: index * 0.08,
                                                            type: "spring",
                                                            stiffness: 200,
                                                            damping: 20
                                                        }}
                                                    >
                                                        <div className="relative rounded-lg">
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
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-semibold">
                                    🎬 플로우 완성!
                                </h2>
                                <p className="text-[14px] md:text-[16px] lg:text-[16px] text-white/70">
                                    총 {flowCaptures.length > 0 ? flowCaptures.length : crawledPages.filter(p => p.success).length}개의 화면을 캡처했어요
                                </p>
                                <p className="text-sm text-white/50">
                                    원하는 화면을 선택해서 다운로드하거나 Figma에 복사하세요
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6" style={{ gridAutoRows: 'fit-content' }}>
                                    {/* 표준 캡처 결과 */}
                                    {crawledPages.length > 0 && crawledPages.map((page, index) => (
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
                                                    <div className="p-2" style={{ minHeight: 'fit-content', height: 'auto' }}>
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
                                                <div className="p-2 flex items-center justify-center" style={{ minHeight: 'fit-content' }}>
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
                                    
                                    {/* 플로우 캡처 결과 */}
                                    {flowCaptures.length > 0 && (
                                        <>
                                            {/* Figma 디자인 기반 플로우 캡처 결과 UI - 반응형 개선 */}
                                            <div className="mb-6 w-full max-w-[1200px] mx-auto px-4">
                                                <div className="bg-[#05070a] rounded-2xl p-6 sm:p-8 border border-white/10">
                                                    {/* 상단 헤더 - Figma 스타일 */}
                                                    <div className="text-center mb-8">
                                                        <h2 className="text-3xl lg:text-[30px] font-semibold text-white text-center mb-3">
                                                            플로우 캡처 결과
                                                        </h2>
                                                        <p className="text-white/60 text-center text-base">
                                                            {flowCaptures.length}개의 페이지가 성공적으로 캡처되었습니다.
                                                        </p>
                                                    </div>

                                                    {/* 선택 상태 및 컨트롤 영역 */}
                                                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                                                        {/* 선택 정보 바 */}
                                                        <div className="flex items-center justify-between mb-6">
                                                            <span className="text-white/60 text-sm">
                                                                {selectedFlowCaptures.length}개 선택됨
                                                            </span>
                                                            {selectedFlowCaptures.length > 0 && (
                                                                <button
                                                                    onClick={() => setSelectedFlowCaptures([])}
                                                                    className="text-[#60a5fa] hover:text-blue-300 text-sm transition-colors"
                                                                >
                                                                    선택 해제
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* 캡처 결과 그리드 - 웹 브레이크포인트 최적화 */}
                                                        <div className="grid grid-cols-1 min-[500px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mb-8 p-4 md:p-6">
                                                            {flowCaptures.map((capture, index) => {
                                                                const isSelected = selectedFlowCaptures.includes(index.toString());
                                                                const gradients = [
                                                                    'from-blue-500/20 to-purple-500/20',
                                                                    'from-green-500/20 to-blue-500/20', 
                                                                    'from-purple-500/20 to-pink-500/20',
                                                                    'from-orange-500/20 to-red-500/20'
                                                                ];
                                                                const borderColors = [
                                                                    'border-blue-500',
                                                                    'border-green-500',
                                                                    'border-purple-500', 
                                                                    'border-orange-500'
                                                                ];
                                                                
                                                                return (
                                                                    <motion.div
                                                                        key={capture.step}
                                                                        className={`relative group rounded-xl border-2 transition-all bg-gradient-to-br cursor-pointer overflow-visible min-h-[280px] ${gradients[index % 4]} ${
                                                                            isSelected 
                                                                                ? `${borderColors[index % 4]} bg-opacity-100` 
                                                                                : 'border-white/20 hover:border-white/40'
                                                                        }`}
                                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        transition={{ delay: index * 0.1 }}
                                                                        onClick={() => toggleFlowSelection(index)}
                                                                    >
                                                                        {/* 체크박스 - 충분한 여백으로 좌상단 배치 */}
                                                                        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-30">
                                                                            <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 shadow-lg transition-all ${
                                                                                isSelected 
                                                                                    ? 'bg-blue-500 border-blue-500 scale-110' 
                                                                                    : 'bg-white/95 border-white/60 backdrop-blur-sm hover:bg-white hover:border-white/80'
                                                                            }`}>
                                                                                {isSelected && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                                                                            </div>
                                                                        </div>

                                                                        {/* 호버 액션 버튼들 - 우상단 */}
                                                                        <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 md:gap-2">
                                                                            {/* 클립보드 복사 버튼 */}
                                                                            <motion.button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const screenshot = capture.buffer || capture.screenshot;
                                                                                    if (screenshot) {
                                                                                        copyToClipboard(screenshot);
                                                                                    }
                                                                                }}
                                                                                whileHover={{ scale: 1.1 }}
                                                                                whileTap={{ scale: 0.9 }}
                                                                                className="bg-white/90 hover:bg-white backdrop-blur-sm rounded-lg p-1.5 shadow-lg transition-all"
                                                                                title="클립보드 복사"
                                                                            >
                                                                                <Copy className="w-3 h-3 text-gray-700" />
                                                                            </motion.button>
                                                                            
                                                                            {/* 아카이브 버튼 */}
                                                                            <motion.button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const screenshot = capture.buffer || capture.screenshot;
                                                                                    if (screenshot) {
                                                                                        setCurrentImageForArchive({
                                                                                            screenshot,
                                                                                            title: capture.title,
                                                                                            url: capture.url
                                                                                        });
                                                                                        setShowTagModal(true);
                                                                                    }
                                                                                }}
                                                                                whileHover={{ scale: 1.1 }}
                                                                                whileTap={{ scale: 0.9 }}
                                                                                className="bg-white/90 hover:bg-white backdrop-blur-sm rounded-lg p-1.5 shadow-lg transition-all"
                                                                                title="아카이브에 저장"
                                                                            >
                                                                                <Bookmark className="w-3 h-3 text-gray-700" />
                                                                            </motion.button>

                                                                        </div>

                                                                        {/* 이미지 영역 - 고정 비율 */}
                                                                        <div className="relative">
                                                                            <div className="aspect-[4/3] bg-black/10">
                                                                                <img
                                                                                    src={`data:image/png;base64,${capture.buffer}`}
                                                                                    alt={capture.title}
                                                                                    className="w-full h-full object-contain p-2"
                                                                                    loading="lazy"
                                                                                    decoding="async"
                                                                                    style={{ 
                                                                                        imageRendering: 'auto',
                                                                                        maxWidth: '100%',
                                                                                        height: 'auto'
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            
                                                                            {/* 단계 표시 - 중앙 하단 */}
                                                                            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
                                                                                단계 {capture.step}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* 정보 영역 */}
                                                                        <div className="p-4 bg-black/30">
                                                                            <h3 className="text-white font-medium text-sm mb-1 truncate" title={capture.title}>
                                                                                {capture.title}
                                                                            </h3>
                                                                            <p className="text-white/50 text-xs truncate" title={capture.url}>
                                                                                {capture.url}
                                                                            </p>
                                                                        </div>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* 하단 액션 버튼들 - 웹 브레이크포인트 최적화 */}
                                                        {selectedFlowCaptures.length > 0 && (
                                                            <div className="pt-6 border-t border-white/10">
                                                                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFlowCaptures([]);
                                                                            setFlowCaptures([]);
                                                                            setCurrentStep('input');
                                                                            setInputUrl('');
                                                                        }}
                                                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 text-sm font-medium min-w-[120px] justify-center"
                                                                    >
                                                                        <RotateCcw className="w-4 h-4" />
                                                                        다시 시작
                                                                    </button>
                                                                    
                                                                    <button
                                                                        onClick={copySelectedToClipboard}
                                                                        className="flex items-center gap-2 px-4 py-2.5 bg-transparent hover:bg-white/5 text-white rounded-lg border border-white transition-colors text-sm font-medium min-w-[140px] justify-center"
                                                                    >
                                                                        <Copy className="w-4 h-4" />
                                                                        클립보드 복사
                                                                    </button>
                                                                    
                                                                    <button
                                                                        onClick={downloadSelectedImages}
                                                                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-100 text-black rounded-lg transition-colors font-medium text-sm min-w-[140px] justify-center"
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                        다운로드 ({selectedFlowCaptures.length}개)
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}


                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="flex gap-3">
                                        <motion.button
                                            onClick={startNew}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm transition-colors"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            다시 시작
                                        </motion.button>

                                        <motion.a
                                            href="/archive"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg text-sm transition-colors text-purple-300 hover:text-purple-200"
                                        >
                                            <Archive className="w-4 h-4" />
                                            아카이브 보기
                                        </motion.a>
                                    </div>
                                    
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
                                <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-semibold">다운로드 완료!</h2>
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

            {/* 태그 입력 모달 */}
            <AnimatePresence>
                {showTagModal && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowTagModal(false)}
                    >
                        <motion.div
                            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/20"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <TagInputModal
                                onSave={bulkSaveToArchive}
                                onClose={() => setShowTagModal(false)}
                                isMultiple={!currentImageForArchive}
                                count={currentImageForArchive ? 1 : selectedFlowCaptures.length}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            </div>
        </BeamsBackground>
    );
}

// 태그 입력 모달 컴포넌트
function TagInputModal({ 
    onSave, 
    onClose, 
    isMultiple, 
    count 
}: { 
    onSave: (tags: string[]) => void;
    onClose: () => void;
    isMultiple: boolean;
    count: number;
}) {
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(['UI', '레퍼런스']);
    const [predefinedTags] = useState([
        'UI/UX', '레퍼런스', '디자인', '웹사이트', '모바일', '데스크탑',
        '인터페이스', '레이아웃', '색상', '타이포그래피', '아이콘', '버튼',
        '폼', '네비게이션', '카드', '목록', '테이블', '차트', '그래프'
    ]);

    const addTag = (tag: string) => {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
        }
        setTagInput('');
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagInput);
        }
    };

    const handleSave = () => {
        if (tags.length === 0) {
            alert('최소 1개의 태그를 입력해주세요.');
            return;
        }
        onSave(tags);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">
                    {isMultiple ? `${count}개 이미지 아카이브` : '이미지 아카이브'}
                </h3>
            </div>

            <p className="text-sm text-white/70">
                이미지에 태그를 추가하여 나중에 쉽게 찾을 수 있습니다.
            </p>

            {/* 태그 입력 */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">태그 입력</label>
                <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="태그를 입력하고 Enter를 누르세요"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
            </div>

            {/* 미리 정의된 태그들 */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">추천 태그</label>
                <div className="flex flex-wrap gap-2">
                    {predefinedTags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                tags.includes(tag)
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* 선택된 태그들 */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">선택된 태그</label>
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <div
                            key={tag}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-full"
                        >
                            <span>{tag}</span>
                            <button
                                onClick={() => removeTag(tag)}
                                className="hover:bg-purple-700 rounded-full p-0.5"
                            >
                                <XCircle className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="flex justify-end gap-3 pt-4">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                    취소
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    아카이브에 저장
                </button>
            </div>
        </div>
    );
}
