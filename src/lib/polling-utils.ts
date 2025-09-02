// 🔄 통합 폴링 유틸리티
// 모든 캡처 프로세스에서 일관된 폴링 로직 제공

export interface PollingOptions {
  sessionId: string;
  endpoint: string;
  maxAttempts?: number;
  interval?: number;
  initialDelay?: number;
  onProgress?: (data: any) => void;
  onCompleted: (data: any) => void;
  onFailed: (error: string) => void;
  onTimeout?: () => void;
}

export interface PollingState {
  attempts: number;
  isActive: boolean;
  lastError?: string;
}

export class PollingManager {
  private state: PollingState = {
    attempts: 0,
    isActive: false
  };
  
  private timeoutId?: NodeJS.Timeout;
  private options: Required<PollingOptions>;

  constructor(options: PollingOptions) {
    this.options = {
      maxAttempts: 60, // 기본 5분 (5초 간격)
      interval: 3000, // 3초 간격으로 통일
      initialDelay: 2000, // 2초 후 시작
      onProgress: options.onProgress ?? (() => {}), // ✅ 기본 더미 함수 제공
      onTimeout: () => {
        console.warn(`[PollingManager] 타임아웃: ${this.options.sessionId}`);
      },
      ...options
    };
  }

  start(): void {
    if (this.state.isActive) {
      console.warn(`[PollingManager] 이미 활성화된 폴링: ${this.options.sessionId}`);
      return;
    }

    console.log(`[PollingManager] 폴링 시작: ${this.options.sessionId}`);
    console.log(`[PollingManager] 설정:`, {
      endpoint: this.options.endpoint,
      maxAttempts: this.options.maxAttempts,
      interval: this.options.interval,
      initialDelay: this.options.initialDelay
    });

    this.state = {
      attempts: 0,
      isActive: true,
      lastError: undefined
    };

    // 초기 지연 후 폴링 시작
    this.timeoutId = setTimeout(() => {
      this.poll();
    }, this.options.initialDelay);
  }

  stop(): void {
    console.log(`[PollingManager] 폴링 중지: ${this.options.sessionId}`);
    this.state.isActive = false;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  private async poll(): Promise<void> {
    if (!this.state.isActive) {
      return;
    }

    this.state.attempts++;
    console.log(`[PollingManager] 폴링 시도 ${this.state.attempts}/${this.options.maxAttempts}: ${this.options.sessionId}`);

    try {
      const response = await fetch(`${this.options.endpoint}?sessionId=${this.options.sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Session not found: ${this.options.sessionId}`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log(`[PollingManager] 응답 받음:`, {
        sessionId: this.options.sessionId,
        status: data.status,
        attempt: this.state.attempts
      });

      // 상태별 처리
      if (data.status === 'completed') {
        console.log(`[PollingManager] ✅ 완료: ${this.options.sessionId}`);
        this.stop();
        this.options.onCompleted(data);
        return;
      }

      if (data.status === 'failed') {
        console.log(`[PollingManager] ❌ 실패: ${this.options.sessionId}`);
        this.stop();
        this.options.onFailed(data.error || '알 수 없는 오류가 발생했습니다.');
        return;
      }

      // 진행 중 - 진행 상황 업데이트
      if (this.options.onProgress) {
        this.options.onProgress(data);
      }

      // 다음 폴링 스케줄링
      this.scheduleNextPoll();

    } catch (error) {
      console.error(`[PollingManager] 폴링 에러 (시도 ${this.state.attempts}):`, error);
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';

      // 404 에러는 즉시 실패 처리
      if (this.state.lastError.includes('Session not found')) {
        console.error(`[PollingManager] 세션 없음 - 즉시 실패 처리: ${this.options.sessionId}`);
        this.stop();
        this.options.onFailed('세션을 찾을 수 없습니다. 다시 시도해주세요.');
        return;
      }

      // 네트워크 오류 등은 재시도
      if (this.state.attempts < this.options.maxAttempts) {
        console.log(`[PollingManager] 재시도 예정: ${this.options.sessionId}`);
        this.scheduleNextPoll();
      } else {
        console.error(`[PollingManager] 최대 시도 횟수 초과: ${this.options.sessionId}`);
        this.stop();
        this.options.onFailed(`최대 재시도 횟수를 초과했습니다. (${this.state.lastError})`);
      }
    }
  }

  private scheduleNextPoll(): void {
    if (!this.state.isActive) {
      return;
    }

    if (this.state.attempts >= this.options.maxAttempts) {
      console.warn(`[PollingManager] 최대 시도 횟수 도달: ${this.options.sessionId}`);
      this.stop();
      this.options.onTimeout?.();
      return;
    }

    console.log(`[PollingManager] 다음 폴링 예약 (${this.options.interval}ms 후): ${this.options.sessionId}`);
    this.timeoutId = setTimeout(() => {
      this.poll();
    }, this.options.interval);
  }

  getState(): PollingState {
    return { ...this.state };
  }
}

// 편의 함수들
export function createAutoCapturePoll(
  sessionId: string,
  onProgress: (data: any) => void,
  onCompleted: (data: any) => void,
  onFailed: (error: string) => void
): PollingManager {
  return new PollingManager({
    sessionId,
    endpoint: '/api/auto-capture',
    onProgress,
    onCompleted,
    onFailed,
    maxAttempts: 60, // 3분 (3초 간격)
    interval: 3000,
    initialDelay: 2000
  });
}

export function createSelectiveCapturePoll(
  sessionId: string,
  onProgress: (data: any) => void,
  onCompleted: (data: any) => void,
  onFailed: (error: string) => void
): PollingManager {
  return new PollingManager({
    sessionId,
    endpoint: '/api/selective-capture',
    onProgress,
    onCompleted,
    onFailed,
    maxAttempts: 40, // 2분 (3초 간격)
    interval: 3000,
    initialDelay: 2000
  });
}

export function createCapturePoll(
  sessionId: string,
  onProgress: (data: any) => void,
  onCompleted: (data: any) => void,
  onFailed: (error: string) => void
): PollingManager {
  return new PollingManager({
    sessionId,
    endpoint: '/api/capture',
    onProgress,
    onCompleted,
    onFailed,
    maxAttempts: 30, // 1.5분 (3초 간격)
    interval: 3000,
    initialDelay: 2000
  });
}
