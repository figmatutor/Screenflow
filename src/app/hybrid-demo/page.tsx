'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Clock, ExternalLink, Zap, Server } from 'lucide-react'

interface CaptureResult {
  success: boolean
  url?: string
  maxSteps?: number
  actualSteps?: number
  screenshots?: Array<{
    step: number
    title: string
    url: string
    screenshot: string
  }>
  captureId?: string
  service?: string
  message?: string
  error?: string
}

interface ServiceStatus {
  service: string
  status: string
  externalBrowserService: {
    available: boolean
    status: string
  }
  capabilities: {
    flowCapture: boolean
    fallback: boolean
    maxSteps: number
    supportedTriggers: string[]
  }
}

export default function HybridDemoPage() {
  const [url, setUrl] = useState('https://example.com')
  const [maxSteps, setMaxSteps] = useState(3)
  const [triggerKeywords, setTriggerKeywords] = useState('다음,시작,Next,Start,Continue,계속')
  const [waitTime, setWaitTime] = useState(3000)
  
  const [isCapturing, setIsCapturing] = useState(false)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [progress, setProgress] = useState(0)

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/api/hybrid-flow-capture')
      const status = await response.json()
      setServiceStatus(status)
    } catch (error) {
      console.error('서비스 상태 확인 실패:', error)
    }
  }

  const startCapture = async () => {
    if (!url.trim()) {
      alert('URL을 입력해주세요')
      return
    }

    setIsCapturing(true)
    setResult(null)
    setProgress(0)

    // 진행률 시뮬레이션
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 1000)

    try {
      const response = await fetch('/api/hybrid-flow-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          maxSteps,
          triggerKeywords: triggerKeywords.split(',').map(k => k.trim()),
          waitTime
        })
      })

      const data = await response.json()
      setResult(data)
      setProgress(100)

    } catch (error) {
      console.error('캡처 실패:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    } finally {
      clearInterval(progressInterval)
      setIsCapturing(false)
    }
  }

  const testBrowserService = async () => {
    try {
      const response = await fetch('/api/test-browser-service')
      const data = await response.json()
      alert(data.success ? '브라우저 서비스 연결 성공!' : `연결 실패: ${data.error}`)
    } catch (error) {
      alert(`테스트 실패: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🚀 하이브리드 플로우 캡처 데모
          </h1>
          <p className="text-gray-600">
            외부 브라우저 서비스와 로컬 처리를 결합한 새로운 아키텍처
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 설정 패널 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  캡처 설정
                </CardTitle>
                <CardDescription>
                  플로우 캡처 매개변수를 설정하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">URL</label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">최대 단계</label>
                  <Input
                    type="number"
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    min={1}
                    max={10}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">트리거 키워드 (쉼표 구분)</label>
                  <Textarea
                    value={triggerKeywords}
                    onChange={(e) => setTriggerKeywords(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">대기 시간 (ms)</label>
                  <Input
                    type="number"
                    value={waitTime}
                    onChange={(e) => setWaitTime(Number(e.target.value))}
                    min={1000}
                    max={10000}
                    step={1000}
                  />
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={startCapture} 
                    disabled={isCapturing}
                    className="w-full"
                  >
                    {isCapturing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        캡처 중...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        플로우 캡처 시작
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={checkServiceStatus} 
                    variant="outline"
                    className="w-full"
                  >
                    <Server className="h-4 w-4 mr-2" />
                    서비스 상태 확인
                  </Button>

                  <Button 
                    onClick={testBrowserService} 
                    variant="outline"
                    className="w-full"
                  >
                    브라우저 서비스 테스트
                  </Button>
                </div>

                {isCapturing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>진행률</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 서비스 상태 */}
            {serviceStatus && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">서비스 상태</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>하이브리드 서비스</span>
                    <Badge variant="default">
                      {serviceStatus.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>외부 브라우저 서비스</span>
                    <Badge variant={serviceStatus.externalBrowserService.available ? "default" : "secondary"}>
                      {serviceStatus.externalBrowserService.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>최대 단계: {serviceStatus.capabilities.maxSteps}</p>
                    <p>Fallback: {serviceStatus.capabilities.fallback ? '지원' : '미지원'}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 결과 패널 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result?.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : result?.error ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                  캡처 결과
                </CardTitle>
                <CardDescription>
                  {result ? (
                    <div className="flex items-center gap-2">
                      <span>서비스: </span>
                      <Badge variant={result.service === 'external' ? 'default' : 'secondary'}>
                        {result.service === 'external' ? '외부 서비스' : 
                         result.service === 'local-fallback' ? '로컬 Fallback' : 
                         result.service || '알 수 없음'}
                      </Badge>
                    </div>
                  ) : (
                    '캡처를 시작하면 결과가 여기에 표시됩니다'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result?.error ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">오류 발생</h4>
                    <p className="text-red-600">{result.error}</p>
                  </div>
                ) : result?.success ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">캡처 성공!</h4>
                      <p className="text-green-600">{result.message}</p>
                      <div className="mt-2 text-sm text-green-700">
                        <p>URL: {result.url}</p>
                        <p>단계: {result.actualSteps}/{result.maxSteps}</p>
                        {result.captureId && <p>캡처 ID: {result.captureId}</p>}
                      </div>
                    </div>

                    {result.screenshots && result.screenshots.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">캡처된 스크린샷 ({result.screenshots.length}개)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.screenshots.map((screenshot, index) => (
                            <div key={index} className="border rounded-lg overflow-hidden">
                              <img
                                src={`data:image/png;base64,${screenshot.screenshot}`}
                                alt={`Step ${screenshot.step}: ${screenshot.title}`}
                                className="w-full h-48 object-cover"
                              />
                              <div className="p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <Badge variant="outline">
                                    단계 {screenshot.step}
                                  </Badge>
                                  <a
                                    href={screenshot.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                                <h5 className="font-medium text-sm truncate">
                                  {screenshot.title}
                                </h5>
                                <p className="text-xs text-gray-500 truncate">
                                  {screenshot.url}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>캡처 결과를 기다리는 중...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 아키텍처 설명 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>🏗️ 하이브리드 아키텍처</CardTitle>
            <CardDescription>
              외부 브라우저 서비스와 로컬 처리를 결합한 새로운 방식
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4 text-blue-600" />
                  외부 브라우저 서비스 (Railway)
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 무제한 실행 시간</li>
                  <li>• 더 많은 메모리 사용 가능</li>
                  <li>• 브라우저 인스턴스 재사용</li>
                  <li>• 복잡한 플로우 처리 가능</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  로컬 Fallback (Vercel)
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 외부 서비스 장애 시 대응</li>
                  <li>• 기존 기능 유지</li>
                  <li>• 빠른 응답 시간</li>
                  <li>• 안정적인 서비스 제공</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
