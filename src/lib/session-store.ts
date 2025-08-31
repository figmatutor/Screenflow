// 스크린샷 캡처 세션 관리
// 실제 환경에서는 Redis나 DB 사용 권장

export interface Screenshot {
  url: string;
  filename: string;
  buffer: Buffer;
  size: number;
}

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  screenshots: Screenshot[];
  error?: string;
}

// 메모리 기반 세션 저장소
const sessions = new Map<string, CaptureSession>();

export const sessionStore = {
  get(sessionId: string): CaptureSession | undefined {
    return sessions.get(sessionId);
  },

  set(sessionId: string, session: CaptureSession): void {
    sessions.set(sessionId, session);
  },

  delete(sessionId: string): boolean {
    return sessions.delete(sessionId);
  },

  has(sessionId: string): boolean {
    return sessions.has(sessionId);
  },

  clear(): void {
    sessions.clear();
  }
};

