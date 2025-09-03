'use client';

import { useEffect, useState } from 'react';
import { DesktopCaptureStudio } from '@/components/desktop/DesktopCaptureStudio';
import { ScreencaptureStudio } from '@/components/ui/screencapture-studio';
import { isElectronEnvironment } from '@/lib/electron-utils';

/**
 * 🖥️ 데스크톱/웹 환경 자동 감지 페이지
 * 
 * Electron 환경에서는 DesktopCaptureStudio 사용
 * 웹 환경에서는 기존 ScreencaptureStudio 사용
 */
export default function DesktopPage() {
  const [isElectron, setIsElectron] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 클라이언트 사이드에서 환경 확인
    setIsElectron(isElectronEnvironment());
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">환경을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // Electron 환경에서는 데스크톱 전용 컴포넌트 사용
  if (isElectron) {
    return <DesktopCaptureStudio />;
  }

  // 웹 환경에서는 기존 컴포넌트 사용
  return <ScreencaptureStudio />;
}
