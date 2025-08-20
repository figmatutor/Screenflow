// Supabase 기반 세션 저장소 (서버리스 환경에서 안정적)
import { supabaseAdmin } from './supabase';

export interface CaptureSession {
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
}

class SupabaseCaptureStore {
  private readonly tableName = 'capture_sessions';

  async set(sessionId: string, session: CaptureSession): Promise<void> {
    try {
      console.log(`[SupabaseCaptureStore] Setting session ${sessionId}:`, session.status);
      
      if (!supabaseAdmin) {
        console.warn('[SupabaseCaptureStore] Supabase not configured, falling back to memory');
        return;
      }

      const { error } = await supabaseAdmin
        .from(this.tableName)
        .upsert({
          session_id: sessionId,
          status: session.status,
          result: session.result || null,
          error: session.error || null,
          created_at: session.createdAt.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[SupabaseCaptureStore] Error setting session:', error);
      }
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in set:', err);
    }
  }

  async get(sessionId: string): Promise<CaptureSession | null> {
    try {
      console.log(`[SupabaseCaptureStore] Getting session ${sessionId}`);
      
      if (!supabaseAdmin) {
        console.warn('[SupabaseCaptureStore] Supabase not configured');
        return null;
      }

      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        console.error(`[SupabaseCaptureStore] Error getting session ${sessionId}:`, error);
        return null;
      }

      if (!data) {
        console.log(`[SupabaseCaptureStore] Session ${sessionId} not found`);
        return null;
      }

      const session: CaptureSession = {
        status: data.status,
        result: data.result,
        error: data.error,
        createdAt: new Date(data.created_at)
      };

      console.log(`[SupabaseCaptureStore] Session ${sessionId} found:`, session.status);
      return session;
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in get:', err);
      return null;
    }
  }

  async update(sessionId: string, updates: Partial<CaptureSession>): Promise<void> {
    try {
      console.log(`[SupabaseCaptureStore] Updating session ${sessionId}:`, updates.status);
      
      if (!supabaseAdmin) {
        console.warn('[SupabaseCaptureStore] Supabase not configured');
        return;
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.status) updateData.status = updates.status;
      if (updates.result !== undefined) updateData.result = updates.result;
      if (updates.error !== undefined) updateData.error = updates.error;

      const { error } = await supabaseAdmin
        .from(this.tableName)
        .update(updateData)
        .eq('session_id', sessionId);

      if (error) {
        console.error('[SupabaseCaptureStore] Error updating session:', error);
      }
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in update:', err);
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      console.log(`[SupabaseCaptureStore] Deleting session ${sessionId}`);
      
      if (!supabaseAdmin) {
        console.warn('[SupabaseCaptureStore] Supabase not configured');
        return false;
      }

      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('[SupabaseCaptureStore] Error deleting session:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in delete:', err);
      return false;
    }
  }

  async getAllSessions(): Promise<Record<string, CaptureSession>> {
    try {
      console.log(`[SupabaseCaptureStore] Getting all sessions`);
      
      if (!supabaseAdmin) {
        console.warn('[SupabaseCaptureStore] Supabase not configured');
        return {};
      }

      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SupabaseCaptureStore] Error getting all sessions:', error);
        return {};
      }

      const sessions: Record<string, CaptureSession> = {};
      for (const row of data || []) {
        sessions[row.session_id] = {
          status: row.status,
          result: row.result,
          error: row.error,
          createdAt: new Date(row.created_at)
        };
      }

      console.log(`[SupabaseCaptureStore] Found ${Object.keys(sessions).length} sessions`);
      return sessions;
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in getAllSessions:', err);
      return {};
    }
  }

  async cleanup(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      if (!supabaseAdmin) {
        return;
      }

      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .lt('created_at', oneHourAgo);

      if (error) {
        console.error('[SupabaseCaptureStore] Error in cleanup:', error);
      } else {
        console.log('[SupabaseCaptureStore] Cleanup completed');
      }
    } catch (err) {
      console.error('[SupabaseCaptureStore] Exception in cleanup:', err);
    }
  }
}

// 싱글톤 인스턴스
const supabaseCaptureStore = new SupabaseCaptureStore();

export { supabaseCaptureStore as captureStore };
