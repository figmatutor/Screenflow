// Hybrid 저장소: Supabase 우선, 메모리 fallback
import { supabaseAdmin } from './supabase';

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
}

class HybridCaptureStore {
  private sessions: Map<string, CaptureSession> = new Map();
  private readonly useSupabase: boolean;

  constructor() {
    this.useSupabase = !!supabaseAdmin && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log(`[HybridCaptureStore] Initialized with ${this.useSupabase ? 'Supabase' : 'Memory'} storage`);
  }

  async set(sessionId: string, session: CaptureSession): Promise<void> {
    console.log(`[HybridCaptureStore] Setting session ${sessionId}:`, session.status);
    
    // 항상 메모리에도 저장 (빠른 접근용)
    this.sessions.set(sessionId, session);
    
    if (this.useSupabase) {
      try {
        const { error } = await supabaseAdmin!
          .from('capture_sessions')
          .upsert({
            session_id: sessionId,
            status: session.status,
            result: session.result || null,
            error: session.error || null,
            created_at: session.createdAt.toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('[HybridCaptureStore] Supabase error, using memory only:', error);
        }
      } catch (err) {
        console.error('[HybridCaptureStore] Supabase exception, using memory only:', err);
      }
    }
  }

  async get(sessionId: string): Promise<CaptureSession | null> {
    console.log(`[HybridCaptureStore] Getting session ${sessionId}`);
    
    // 먼저 메모리에서 확인
    const memorySession = this.sessions.get(sessionId);
    if (memorySession) {
      console.log(`[HybridCaptureStore] Found in memory: ${sessionId}:`, memorySession.status);
      return memorySession;
    }
    
    // Supabase에서 확인
    if (this.useSupabase) {
      try {
        const { data, error } = await supabaseAdmin!
          .from('capture_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (!error && data) {
          const session: CaptureSession = {
            status: data.status,
            result: data.result,
            error: data.error,
            createdAt: new Date(data.created_at)
          };
          
          // 메모리에도 캐시
          this.sessions.set(sessionId, session);
          console.log(`[HybridCaptureStore] Found in Supabase: ${sessionId}:`, session.status);
          return session;
        }
      } catch (err) {
        console.error('[HybridCaptureStore] Supabase get error:', err);
      }
    }
    
    console.log(`[HybridCaptureStore] Session not found: ${sessionId}`);
    console.log(`[HybridCaptureStore] Memory sessions:`, Array.from(this.sessions.keys()));
    return null;
  }

  async update(sessionId: string, updates: Partial<CaptureSession>): Promise<void> {
    console.log(`[HybridCaptureStore] Updating session ${sessionId}:`, updates.status);
    
    // 메모리 업데이트
    const existing = this.sessions.get(sessionId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.sessions.set(sessionId, updated);
    }
    
    // Supabase 업데이트
    if (this.useSupabase) {
      try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.status) updateData.status = updates.status;
        if (updates.result !== undefined) updateData.result = updates.result;
        if (updates.error !== undefined) updateData.error = updates.error;

        await supabaseAdmin!
          .from('capture_sessions')
          .update(updateData)
          .eq('session_id', sessionId);
      } catch (err) {
        console.error('[HybridCaptureStore] Supabase update error:', err);
      }
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    console.log(`[HybridCaptureStore] Deleting session ${sessionId}`);
    
    const deleted = this.sessions.delete(sessionId);
    
    if (this.useSupabase) {
      try {
        await supabaseAdmin!
          .from('capture_sessions')
          .delete()
          .eq('session_id', sessionId);
      } catch (err) {
        console.error('[HybridCaptureStore] Supabase delete error:', err);
      }
    }
    
    return deleted;
  }

  async getAllSessions(): Promise<Record<string, CaptureSession>> {
    console.log(`[HybridCaptureStore] Getting all sessions`);
    
    const result: Record<string, CaptureSession> = {};
    
    // 메모리 세션들 추가
    for (const [id, session] of this.sessions.entries()) {
      result[id] = session;
    }
    
    // Supabase 세션들도 추가
    if (this.useSupabase) {
      try {
        const { data } = await supabaseAdmin!
          .from('capture_sessions')
          .select('*')
          .order('created_at', { ascending: false });

        for (const row of data || []) {
          if (!result[row.session_id]) {
            result[row.session_id] = {
              status: row.status,
              result: row.result,
              error: row.error,
              createdAt: new Date(row.created_at)
            };
          }
        }
      } catch (err) {
        console.error('[HybridCaptureStore] Supabase getAllSessions error:', err);
      }
    }
    
    console.log(`[HybridCaptureStore] Total sessions: ${Object.keys(result).length}`);
    return result;
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
      console.log(`[HybridCaptureStore] Cleaned up ${deleted} old sessions from memory`);
    }
  }
}

// 싱글톤 인스턴스
const hybridCaptureStore = new HybridCaptureStore();

export { hybridCaptureStore as captureStore };
