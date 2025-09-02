'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { dockerPlaywrightClient, type ScreenshotOptions, type BrowserStatus } from '@/lib/docker-playwright-client';
import { Download, Copy, RefreshCw, Monitor, Settings, Zap, AlertCircle } from 'lucide-react';

interface CaptureResult {
  success: boolean;
  screenshot?: string;
  metadata?: any;
  error?: string;
}

export function DockerPlaywrightStudio() {
  // 🎯 상태 관리
  const [url, setUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [serviceHealth, setServiceHealth] = useState<any>(null);

  // ⚙️ 캡처 옵션
  const [options, setOptions] = useState<ScreenshotOptions>({
    browser: 'chromium',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    fullPage: false,
    format: 'png',
    quality: 90,
    timeout: 30000,
    waitUntil: 'networkidle',
    delay: 0,
    animations: 'disabled',
    colorScheme: 'light'
  });

  // 🖼️ 스크린샷 캡처
  const handleCapture = useCallback(async () => {
    if (!url.trim()) {
      setResult({ success: false, error: 'URL을 입력해주세요.' });
      return;
    }

    setIsCapturing(true);
    setResult(null);

    try {
      console.log('[DockerPlaywright] Starting capture:', { url, options });
      
      const captureResult = await dockerPlaywrightClient.captureScreenshot(url, options);
      
      setResult({
        success: captureResult.success,
        screenshot: captureResult.screenshot,
        metadata: captureResult.metadata,
        error: captureResult.error
      });

      // 캡처 후 브라우저 상태 업데이트
      await updateBrowserStatus();

    } catch (error) {
      console.error('[DockerPlaywright] Capture failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '스크린샷 캡처에 실패했습니다.'
      });
    } finally {
      setIsCapturing(false);
    }
  }, [url, options]);

  // 🔍 브라우저 상태 업데이트
  const updateBrowserStatus = useCallback(async () => {
    try {
      const status = await dockerPlaywrightClient.getBrowserStatus();
      setBrowserStatus(status);
    } catch (error) {
      console.error('[DockerPlaywright] Browser status failed:', error);
    }
  }, []);

  // 💓 헬스체크
  const checkServiceHealth = useCallback(async () => {
    try {
      const health = await dockerPlaywrightClient.healthCheck();
      setServiceHealth(health);
    } catch (error) {
      console.error('[DockerPlaywright] Health check failed:', error);
      setServiceHealth({ 
        status: 'ERROR', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }, []);

  // 📥 다운로드
  const handleDownload = useCallback(() => {
    if (!result?.screenshot) return;

    const link = document.createElement('a');
    link.href = result.screenshot;
    link.download = `screenshot-${Date.now()}.${options.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result, options.format]);

  // 📋 클립보드 복사
  const handleCopyToClipboard = useCallback(async () => {
    if (!result?.screenshot) return;

    try {
      // Base64 데이터를 Blob으로 변환
      const response = await fetch(result.screenshot);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      
      alert('스크린샷이 클립보드에 복사되었습니다!');
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  }, [result]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 🎭 헤더 */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🐳 Docker Playwright Studio
        </h1>
        <p className="text-gray-600">
          완전한 제어가 가능한 브라우저 자동화 서비스
        </p>
      </div>

      {/* 📊 서비스 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            서비스 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Button
              onClick={checkServiceHealth}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              헬스체크
            </Button>
            <Button
              onClick={updateBrowserStatus}
              variant="outline"
              size="sm"
            >
              <Monitor className="w-4 h-4 mr-2" />
              브라우저 상태
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 서비스 헬스 */}
            <div className="space-y-2">
              <h4 className="font-semibold">서비스 상태</h4>
              {serviceHealth ? (
                <div className="space-y-1">
                  <Badge variant={serviceHealth.status === 'OK' ? 'default' : 'destructive'}>
                    {serviceHealth.status}
                  </Badge>
                  {serviceHealth.status === 'OK' && (
                    <>
                      <p className="text-sm text-gray-600">
                        업타임: {Math.floor(serviceHealth.uptime / 60)}분
                      </p>
                      <p className="text-sm text-gray-600">
                        메모리: {Math.round(serviceHealth.memory?.heapUsed / 1024 / 1024)}MB
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <Badge variant="secondary">미확인</Badge>
              )}
            </div>

            {/* 브라우저 상태 */}
            <div className="space-y-2">
              <h4 className="font-semibold">브라우저 상태</h4>
              {browserStatus ? (
                <div className="space-y-1">
                  <p className="text-sm">
                    활성 브라우저: {browserStatus.count}/{browserStatus.maxBrowsers}
                  </p>
                  {browserStatus.browsers.map((browser, index) => (
                    <Badge key={index} variant="outline" className="mr-2">
                      {browser.type}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Badge variant="secondary">미확인</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🎯 캡처 설정 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">기본 설정</TabsTrigger>
          <TabsTrigger value="advanced">고급 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                빠른 캡처
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL 입력 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
                />
              </div>

              {/* 기본 옵션 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">브라우저</label>
                  <Select
                    value={options.browser}
                    onValueChange={(value: any) => setOptions(prev => ({ ...prev, browser: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chromium">Chromium</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="webkit">WebKit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">형식</label>
                  <Select
                    value={options.format}
                    onValueChange={(value: any) => setOptions(prev => ({ ...prev, format: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpeg">JPEG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">너비</label>
                  <Input
                    type="number"
                    value={options.width}
                    onChange={(e) => setOptions(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                    min={100}
                    max={4000}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">높이</label>
                  <Input
                    type="number"
                    value={options.height}
                    onChange={(e) => setOptions(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                    min={100}
                    max={4000}
                  />
                </div>
              </div>

              {/* 체크박스 옵션 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fullPage"
                  checked={options.fullPage}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, fullPage: !!checked }))}
                />
                <label htmlFor="fullPage" className="text-sm font-medium">
                  전체 페이지 캡처
                </label>
              </div>

              {/* 캡처 버튼 */}
              <Button
                onClick={handleCapture}
                disabled={isCapturing || !url.trim()}
                className="w-full"
                size="lg"
              >
                {isCapturing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    캡처 중...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    스크린샷 캡처
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                고급 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 품질 설정 */}
              {options.format === 'jpeg' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    품질: {options.quality}%
                  </label>
                  <Slider
                    value={[options.quality || 90]}
                    onValueChange={([value]) => setOptions(prev => ({ ...prev, quality: value }))}
                    max={100}
                    min={1}
                    step={1}
                  />
                </div>
              )}

              {/* 디바이스 스케일 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  디바이스 스케일: {options.deviceScaleFactor}x
                </label>
                <Slider
                  value={[options.deviceScaleFactor || 1]}
                  onValueChange={([value]) => setOptions(prev => ({ ...prev, deviceScaleFactor: value }))}
                  max={3}
                  min={0.1}
                  step={0.1}
                />
              </div>

              {/* 대기 시간 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  추가 대기: {options.delay}ms
                </label>
                <Slider
                  value={[options.delay || 0]}
                  onValueChange={([value]) => setOptions(prev => ({ ...prev, delay: value }))}
                  max={10000}
                  min={0}
                  step={100}
                />
              </div>

              {/* 대기 조건 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">대기 조건</label>
                <Select
                  value={options.waitUntil}
                  onValueChange={(value: any) => setOptions(prev => ({ ...prev, waitUntil: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="load">페이지 로드 완료</SelectItem>
                    <SelectItem value="domcontentloaded">DOM 로드 완료</SelectItem>
                    <SelectItem value="networkidle">네트워크 유휴</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 색상 스키마 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">색상 스키마</label>
                <Select
                  value={options.colorScheme}
                  onValueChange={(value: any) => setOptions(prev => ({ ...prev, colorScheme: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">라이트 모드</SelectItem>
                    <SelectItem value="dark">다크 모드</SelectItem>
                    <SelectItem value="no-preference">기본값</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 애니메이션 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="animations"
                  checked={options.animations === 'allow'}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, animations: checked ? 'allow' : 'disabled' }))
                  }
                />
                <label htmlFor="animations" className="text-sm font-medium">
                  애니메이션 허용
                </label>
              </div>

              {/* 선택자 대기 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">대기할 선택자 (선택사항)</label>
                <Input
                  placeholder="예: .content, #main"
                  value={options.waitForSelector || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, waitForSelector: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 📊 결과 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <Badge variant="default">성공</Badge>
              ) : (
                <Badge variant="destructive">실패</Badge>
              )}
              캡처 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success && result.screenshot ? (
              <div className="space-y-4">
                {/* 메타데이터 */}
                {result.metadata && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">소요시간:</span> {result.metadata.duration}ms
                    </div>
                    <div>
                      <span className="font-medium">브라우저:</span> {result.metadata.browser}
                    </div>
                    <div>
                      <span className="font-medium">크기:</span> {Math.round(result.metadata.size / 1024)}KB
                    </div>
                    <div>
                      <span className="font-medium">해상도:</span> {result.metadata.viewport.width}×{result.metadata.viewport.height}
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                  <Button onClick={handleCopyToClipboard} variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    클립보드 복사
                  </Button>
                </div>

                {/* 이미지 미리보기 */}
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={result.screenshot}
                    alt="Screenshot"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                {result.error || '알 수 없는 오류가 발생했습니다.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
