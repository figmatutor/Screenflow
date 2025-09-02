'use client';

import { DockerPlaywrightStudio } from '@/components/ui/docker-playwright-studio';

/**
 * 🐳 Docker Playwright Studio 페이지
 * 
 * 완전한 제어가 가능한 브라우저 자동화 서비스
 * - 다중 브라우저 지원 (Chromium, Firefox, WebKit)
 * - 고급 스크린샷 옵션
 * - 실시간 모니터링
 * - 배치 처리 지원
 */
export default function DockerPlaywrightPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <DockerPlaywrightStudio />
    </div>
  );
}
