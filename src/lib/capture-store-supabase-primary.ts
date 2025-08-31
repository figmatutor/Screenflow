// Supabase 우선 저장소: 세션 지속성 강화
import { supabaseAdmin } from './supabase';

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  finishedAt?: Date;
}

class SupabasePrimaryCaptureStore {
  private memoryCache: Map<string, CaptureSession> = new Map();
  private readonly forceSupabase: boolean = true; // 강제로 Supabase 사용

  constructor() {
    console.log(`[SupabasePrimaryCaptureStore] 강력한 Supabase 우선 저장소 초기화`);
    this.ensureSupabaseTable();
  }

  private async ensureSupabaseTable(): Promise<void> {
    if (!supabaseAdmin) {
      console.warn('[SupabasePrimaryCaptureStore] Supabase Admin 클라이언트 없음 - 메모리 모드로 fallback');
      return;
    }

    try {
      // 테이블 존재 확인
      const { data, error } = await supabaseAdmin
        .from('capture_sessions')
        .select('id')
        .limit(1);

      if (error) {
        console.error('[SupabasePrimaryCaptureStore] Supabase 테이블 확인 실패:', error);
      } else {
        console.log('[SupabasePrimaryCaptureStore] Supabase 테이블 연결 확인됨');
      }
    } catch (err) {
      console.error('[SupabasePrimaryCaptureStore] Supabase 연결 오류:', err);
    }
  }

  async set(sessionId: string, session: CaptureSession): Promise<void> {
    console.log(`[SupabasePrimaryCaptureStore] 세션 저장 ${sessionId}: ${session.status}`);
    
    // 1. 메모리 캐시에 즉시 저장
    this.memoryCache.set(sessionId, session);
    
    // 2. Supabase에 강제 저장 (여러 번 시도)
    if (supabaseAdmin) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const supabaseData = {
            id: sessionId,
            status: session.status,
            result: session.result || null,
            error: session.error || null,
            created_at: session.createdAt.toISOString(),
            updated_at: new Date().toISOString(),
            url: 'https://naver.com' // 기본값
          };

          const { data, error } = await supabaseAdmin
            .from('capture_sessions')
            .upsert(supabaseData, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })
            .select();

          if (error) {
            throw error;
          }

          console.log(`[SupabasePrimaryCaptureStore] Supabase 저장 성공 (시도 ${attempt}): ${sessionId}`);
          break;
        } catch (err) {
          console.error(`[SupabasePrimaryCaptureStore] Supabase 저장 실패 (시도 ${attempt}/${maxRetries}):`, err);
          if (attempt === maxRetries) {
            console.error(`[SupabasePrimaryCaptureStore] 모든 시도 실패 - 메모리만 사용: ${sessionId}`);
          } else {
            // 재시도 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
    } else {
      console.warn('[SupabasePrimaryCaptureStore] Supabase Admin 없음 - 메모리만 사용');
    }
  }

  async get(sessionId: string): Promise<CaptureSession | null> {
    console.log(`[SupabasePrimaryCaptureStore] 세션 조회 ${sessionId}`);
    
    // 1. 메모리 캐시 우선 확인
    const cachedSession = this.memoryCache.get(sessionId);
    if (cachedSession) {
      console.log(`[SupabasePrimaryCaptureStore] 메모리에서 발견: ${sessionId} (${cachedSession.status})`);
      return cachedSession;
    }
    
    // 2. Supabase에서 강제 조회
    if (supabaseAdmin) {
      try {
        console.log(`[SupabasePrimaryCaptureStore] Supabase에서 조회 중: ${sessionId}`);
        
        const { data, error } = await supabaseAdmin
          .from('capture_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) {
          console.error(`[SupabasePrimaryCaptureStore] Supabase 조회 오류:`, error);
        } else if (data) {
          const session: CaptureSession = {
            status: data.status,
            result: data.result,
            error: data.error,
            createdAt: new Date(data.created_at),
            finishedAt: data.finished_at ? new Date(data.finished_at) : undefined
          };
          
          // 메모리 캐시에 저장
          this.memoryCache.set(sessionId, session);
          console.log(`[SupabasePrimaryCaptureStore] Supabase에서 복구됨: ${sessionId} (${session.status})`);
          return session;
        }
      } catch (err) {
        console.error(`[SupabasePrimaryCaptureStore] Supabase 조회 예외:`, err);
      }
    }
    
    // 3. 전체 로그 출력
    console.error(`[SupabasePrimaryCaptureStore] 세션 없음: ${sessionId}`);
    console.log(`[SupabasePrimaryCaptureStore] 메모리 세션들:`, Array.from(this.memoryCache.keys()));
    
    if (supabaseAdmin) {
      try {
        const { data: allSessions } = await supabaseAdmin
          .from('capture_sessions')
          .select('id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(10);
        
        console.log(`[SupabasePrimaryCaptureStore] 최근 Supabase 세션들:`, 
          allSessions?.map(s => `${s.id}(${s.status})`) || []);
      } catch (err) {
        console.error(`[SupabasePrimaryCaptureStore] Supabase 전체 조회 실패:`, err);
      }
    }
    
    return null;
  }

  async update(sessionId: string, updates: Partial<CaptureSession>): Promise<void> {
    console.log(`[SupabasePrimaryCaptureStore] 세션 업데이트 ${sessionId}:`, updates.status || 'partial');
    
    // 메모리 업데이트
    const existing = this.memoryCache.get(sessionId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.memoryCache.set(sessionId, updated);
    }
    
    // Supabase 업데이트 (재시도 로직)
    if (supabaseAdmin) {
      try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.status) updateData.status = updates.status;
        if (updates.result !== undefined) updateData.result = updates.result;
        if (updates.error !== undefined) updateData.error = updates.error;
        if (updates.finishedAt) updateData.finished_at = updates.finishedAt.toISOString();

        const { error } = await supabaseAdmin
          .from('capture_sessions')
          .update(updateData)
          .eq('id', sessionId);

        if (error) {
          throw error;
        }
        
        console.log(`[SupabasePrimaryCaptureStore] Supabase 업데이트 성공: ${sessionId}`);
      } catch (err) {
        console.error(`[SupabasePrimaryCaptureStore] Supabase 업데이트 실패:`, err);
      }
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    console.log(`[SupabasePrimaryCaptureStore] 세션 삭제: ${sessionId}`);
    
    const memoryDeleted = this.memoryCache.delete(sessionId);
    
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('capture_sessions')
          .delete()
          .eq('id', sessionId);
        console.log(`[SupabasePrimaryCaptureStore] Supabase 삭제 성공: ${sessionId}`);
      } catch (err) {
        console.error(`[SupabasePrimaryCaptureStore] Supabase 삭제 실패:`, err);
      }
    }
    
    return memoryDeleted;
  }

  async getAllSessions(): Promise<Record<string, CaptureSession>> {
    console.log(`[SupabasePrimaryCaptureStore] 모든 세션 조회`);
    
    const result: Record<string, CaptureSession> = {};
    
    // 메모리 세션 추가
    for (const [id, session] of this.memoryCache.entries()) {
      result[id] = session;
    }
    
    // Supabase 세션 추가
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('capture_sessions')
          .select('*')
          .order('created_at', { ascending: false });

        for (const row of data || []) {
          if (!result[row.id]) {
            result[row.id] = {
              status: row.status,
              result: row.result,
              error: row.error,
              createdAt: new Date(row.created_at),
              finishedAt: row.finished_at ? new Date(row.finished_at) : undefined
            };
          }
        }
        
        console.log(`[SupabasePrimaryCaptureStore] Supabase에서 ${data?.length || 0}개 세션 로드됨`);
      } catch (err) {
        console.error(`[SupabasePrimaryCaptureStore] Supabase 전체 조회 실패:`, err);
      }
    }
    
    console.log(`[SupabasePrimaryCaptureStore] 총 ${Object.keys(result).length}개 세션`);
    return result;
  }

  cleanup(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let deleted = 0;
    for (const [sessionId, session] of this.memoryCache.entries()) {
      if (session.createdAt < oneHourAgo) {
        this.memoryCache.delete(sessionId);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      console.log(`[SupabasePrimaryCaptureStore] ${deleted}개 오래된 세션 정리됨`);
    }
  }
}

// 싱글톤 인스턴스
const supabasePrimaryCaptureStore = new SupabasePrimaryCaptureStore();

export { supabasePrimaryCaptureStore as captureStore };
