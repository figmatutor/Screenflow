// 파일 시스템 기반 상태 저장소 (Next.js API 라우트 간 공유 가능)
// 실제 프로덕션에서는 Redis나 데이터베이스를 사용하세요

import fs from 'fs';
import path from 'path';

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
}

class CaptureStore {
  private readonly storePath: string;

  constructor() {
    // 임시 디렉토리에 상태 파일들 저장
    this.storePath = path.join(process.cwd(), 'temp', 'sessions');
    this.ensureStorePath();
  }

  private ensureStorePath() {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storePath, `${sessionId}.json`);
  }
  
  set(sessionId: string, session: CaptureSession) {
    console.log(`[CaptureStore] Setting session: ${sessionId}`, { status: session.status });
    
    try {
      const filePath = this.getSessionFilePath(sessionId);
      
      // Buffer를 직렬화 가능한 형태로 변환
      const serializedSession = this.serializeSession(session);
      
      fs.writeFileSync(filePath, JSON.stringify(serializedSession, null, 2));
      
      // 24시간 후 자동 삭제
      setTimeout(() => {
        this.delete(sessionId);
      }, 24 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error(`[CaptureStore] Error setting session ${sessionId}:`, error);
    }
  }
  
  get(sessionId: string): CaptureSession | undefined {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[CaptureStore] Session file not found: ${sessionId}`);
        return undefined;
      }
      
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsedSession = JSON.parse(data);
      
      // Buffer를 복원
      const session = this.deserializeSession(parsedSession);
      
      console.log(`[CaptureStore] Getting session: ${sessionId}`, { status: session.status });
      return session;
      
    } catch (error) {
      console.error(`[CaptureStore] Error getting session ${sessionId}:`, error);
      return undefined;
    }
  }
  
  delete(sessionId: string) {
    console.log(`[CaptureStore] Deleting session: ${sessionId}`);
    
    try {
      const filePath = this.getSessionFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`[CaptureStore] Error deleting session ${sessionId}:`, error);
    }
  }
  
  update(sessionId: string, updates: Partial<CaptureSession>) {
    const existing = this.get(sessionId);
    if (existing) {
      console.log(`[CaptureStore] Updating session: ${sessionId}`, updates);
      this.set(sessionId, { ...existing, ...updates });
    } else {
      console.warn(`[CaptureStore] Cannot update non-existent session: ${sessionId}`);
    }
  }
  
  // Buffer 직렬화 (파일 저장용)
  private serializeSession(session: CaptureSession): any {
    const serialized = { ...session };
    
    if (session.result?.zipBuffer && Buffer.isBuffer(session.result.zipBuffer)) {
      serialized.result = {
        ...session.result,
        zipBuffer: {
          type: 'Buffer',
          data: Array.from(session.result.zipBuffer)
        }
      };
    }
    
    return serialized;
  }
  
  // Buffer 역직렬화 (파일 읽기용)
  private deserializeSession(parsed: any): CaptureSession {
    const session = { ...parsed };
    
    // 날짜 객체 복원
    if (session.createdAt) {
      session.createdAt = new Date(session.createdAt);
    }
    
    // Buffer 복원
    if (session.result?.zipBuffer?.type === 'Buffer' && Array.isArray(session.result.zipBuffer.data)) {
      session.result.zipBuffer = Buffer.from(session.result.zipBuffer.data);
    }
    
    return session;
  }
  
  // 디버깅용 전체 세션 목록 반환
  getAllSessions(): { [key: string]: CaptureSession } {
    const sessions: { [key: string]: CaptureSession } = {};
    
    try {
      if (fs.existsSync(this.storePath)) {
        const files = fs.readdirSync(this.storePath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const sessionId = file.replace('.json', '');
            const session = this.get(sessionId);
            if (session) {
              sessions[sessionId] = session;
            }
          }
        }
      }
    } catch (error) {
      console.error('[CaptureStore] Error getting all sessions:', error);
    }
    
    return sessions;
  }
  
  // 파일 정리 (오래된 세션들 제거)
  cleanup() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간
    
    try {
      if (fs.existsSync(this.storePath)) {
        const files = fs.readdirSync(this.storePath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.storePath, file);
            const stats = fs.statSync(filePath);
            
            if (now.getTime() - stats.mtime.getTime() > maxAge) {
              fs.unlinkSync(filePath);
              console.log(`[CaptureStore] Cleaned up old session file: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CaptureStore] Error during cleanup:', error);
    }
  }
}

// 싱글톤 인스턴스
export const captureStore = new CaptureStore();

// 주기적으로 정리 (1시간마다)
setInterval(() => {
  captureStore.cleanup();
}, 60 * 60 * 1000);
