import { UrlInputWithLoading } from "@/components/ui/url-input-with-loading";
import { useState } from "react";

export function UrlInputDemo() {
  const [submittedUrls, setSubmittedUrls] = useState<string[]>([]);

  const simulateScreenshotCapture = async (url: string) => {
    console.log("캡처 시작:", url);
    
    // 실제 API 호출 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setSubmittedUrls(prev => [...prev, url]);
    
    // 여기서 실제로는 백엔드 API를 호출하여 스크린샷 캡처 작업을 시작
    // const response = await fetch('/api/capture-screenshots', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ url })
    // });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <UrlInputWithLoading 
          onSubmit={simulateScreenshotCapture}
          loadingDuration={5000}
          placeholder="웹사이트 URL을 입력하세요 (예: https://example.com)"
        />
        
        {/* 히스토리 섹션 (선택적) */}
        {submittedUrls.length > 0 && (
          <div className="mt-12 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              최근 캡처한 웹사이트
            </h3>
            <div className="space-y-2">
              {submittedUrls.slice(-5).reverse().map((url, index) => (
                <div 
                  key={index}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {url}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
