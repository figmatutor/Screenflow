// 메모리 기반 상태 저장소 (Vercel serverless 환경 호환)

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
}

class MemoryCaptureStore {
  private sessions: Map<string, CaptureSession> = new Map();

  set(sessionId: string, session: CaptureSession): void {
    console.log(`[MemoryCaptureStore] Setting session ${sessionId}:`, session.status);
    this.sessions.set(sessionId, session);
  }

  get(sessionId: string): CaptureSession | null {
    const session = this.sessions.get(sessionId);
    console.log(`[MemoryCaptureStore] Getting session ${sessionId}:`, session?.status || 'not found');
    console.log(`[MemoryCaptureStore] Total sessions in memory:`, this.sessions.size);
    console.log(`[MemoryCaptureStore] All session IDs:`, Array.from(this.sessions.keys()));
    return session || null;
  }

  update(sessionId: string, updates: Partial<CaptureSession>): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      const updated = { ...existing, ...updates };
      console.log(`[MemoryCaptureStore] Updating session ${sessionId}:`, existing.status, '->', updated.status);
      this.sessions.set(sessionId, updated);
    } else {
      console.warn(`[MemoryCaptureStore] Attempted to update non-existent session: ${sessionId}`);
    }
  }

  delete(sessionId: string): boolean {
    console.log(`[MemoryCaptureStore] Deleting session ${sessionId}`);
    return this.sessions.delete(sessionId);
  }

  getAllSessions(): Record<string, CaptureSession> {
    const all = Object.fromEntries(this.sessions.entries());
    console.log(`[MemoryCaptureStore] Getting all sessions: ${Object.keys(all).length} sessions`);
    return all;
  }

  cleanup(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let deleted = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.createdAt < oneHourAgo) {
        this.sessions.delete(sessionId);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      console.log(`[MemoryCaptureStore] Cleaned up ${deleted} old sessions`);
    }
  }
}

// 싱글톤 인스턴스
const memoryCaptureStore = new MemoryCaptureStore();

// 주기적으로 오래된 세션 정리 (1시간마다)
if (typeof global !== 'undefined') {
  setInterval(() => {
    memoryCaptureStore.cleanup();
  }, 60 * 60 * 1000);
}

export { memoryCaptureStore as captureStore };
