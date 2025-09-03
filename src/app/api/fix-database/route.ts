// 🔧 데이터베이스 스키마 수정 API

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('[Fix Database] 데이터베이스 스키마 수정 시작');

    if (!supabaseAdmin) {
      throw new Error('Supabase Admin 클라이언트가 초기화되지 않았습니다.');
    }

    // 1. 기존 테이블 삭제 (있다면)
    console.log('[Fix Database] 기존 capture_sessions 테이블 삭제 중...');
    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.capture_sessions CASCADE;'
    });

    if (dropError) {
      console.warn('[Fix Database] 테이블 삭제 중 경고:', dropError);
    }

    // 2. 새 테이블 생성
    console.log('[Fix Database] 새 capture_sessions 테이블 생성 중...');
    const createTableSQL = `
      CREATE TABLE public.capture_sessions (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'pending',
          url TEXT,
          result JSONB,
          error TEXT,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          CONSTRAINT capture_sessions_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
      );
    `;

    const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
      sql: createTableSQL
    });

    if (createError) {
      console.error('[Fix Database] 테이블 생성 실패:', createError);
      throw createError;
    }

    // 3. 인덱스 생성
    console.log('[Fix Database] 인덱스 생성 중...');
    const indexSQL = `
      CREATE INDEX idx_capture_sessions_user_id ON public.capture_sessions(user_id);
      CREATE INDEX idx_capture_sessions_status ON public.capture_sessions(status);
      CREATE INDEX idx_capture_sessions_created_at ON public.capture_sessions(created_at);
    `;

    const { error: indexError } = await supabaseAdmin.rpc('exec_sql', {
      sql: indexSQL
    });

    if (indexError) {
      console.warn('[Fix Database] 인덱스 생성 중 경고:', indexError);
    }

    // 4. RLS 활성화
    console.log('[Fix Database] RLS 정책 설정 중...');
    const rlsSQL = `
      ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "sessions_select_policy" ON public.capture_sessions
          FOR SELECT USING (
              CASE 
                  WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
                  ELSE user_id IS NULL
              END
          );
      
      CREATE POLICY "sessions_insert_policy" ON public.capture_sessions
          FOR INSERT WITH CHECK (
              CASE 
                  WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
                  ELSE user_id IS NULL
              END
          );
      
      CREATE POLICY "sessions_update_policy" ON public.capture_sessions
          FOR UPDATE USING (
              CASE 
                  WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
                  ELSE user_id IS NULL
              END
          ) WITH CHECK (
              CASE 
                  WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
                  ELSE user_id IS NULL
              END
          );
      
      CREATE POLICY "sessions_delete_policy" ON public.capture_sessions
          FOR DELETE USING (
              CASE 
                  WHEN auth.uid() IS NOT NULL THEN auth.uid()::uuid = user_id
                  ELSE user_id IS NULL
              END
          );
    `;

    const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: rlsSQL
    });

    if (rlsError) {
      console.error('[Fix Database] RLS 정책 설정 실패:', rlsError);
      throw rlsError;
    }

    // 5. 트리거 함수 및 트리거 생성
    console.log('[Fix Database] 트리거 설정 중...');
    const triggerSQL = `
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_capture_sessions_updated_at 
          BEFORE UPDATE ON public.capture_sessions 
          FOR EACH ROW 
          EXECUTE FUNCTION public.update_updated_at_column();
    `;

    const { error: triggerError } = await supabaseAdmin.rpc('exec_sql', {
      sql: triggerSQL
    });

    if (triggerError) {
      console.warn('[Fix Database] 트리거 설정 중 경고:', triggerError);
    }

    // 6. 테이블 구조 확인
    console.log('[Fix Database] 테이블 구조 확인 중...');
    const { data: tableInfo, error: infoError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'capture_sessions')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (infoError) {
      console.error('[Fix Database] 테이블 정보 조회 실패:', infoError);
    } else {
      console.log('[Fix Database] 테이블 구조:', tableInfo);
    }

    console.log('[Fix Database] 데이터베이스 스키마 수정 완료');

    return NextResponse.json({
      success: true,
      message: 'capture_sessions 테이블이 성공적으로 생성되었습니다.',
      tableInfo: tableInfo || []
    });

  } catch (error) {
    console.error('[Fix Database] 데이터베이스 수정 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '데이터베이스 스키마 수정에 실패했습니다.'
    }, { status: 500 });
  }
}

// GET 요청으로 현재 테이블 상태 확인
export async function GET(request: NextRequest) {
  try {
    console.log('[Fix Database] 현재 테이블 상태 확인');

    if (!supabaseAdmin) {
      throw new Error('Supabase Admin 클라이언트가 초기화되지 않았습니다.');
    }

    // 테이블 존재 여부 확인
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'capture_sessions');

    if (tablesError) {
      throw tablesError;
    }

    const tableExists = tables && tables.length > 0;

    let columns = [];
    let policies = [];

    if (tableExists) {
      // 컬럼 정보 조회
      const { data: columnInfo, error: columnError } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'capture_sessions')
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (!columnError) {
        columns = columnInfo || [];
      }

      // RLS 정책 정보 조회 (가능한 경우)
      try {
        const { data: policyInfo } = await supabaseAdmin
          .from('pg_policies')
          .select('policyname, cmd, qual')
          .eq('tablename', 'capture_sessions');
        
        policies = policyInfo || [];
      } catch (policyError) {
        console.warn('[Fix Database] 정책 정보 조회 실패:', policyError);
      }
    }

    return NextResponse.json({
      success: true,
      tableExists,
      columns,
      policies,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Fix Database] 상태 확인 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '테이블 상태 확인에 실패했습니다.'
    }, { status: 500 });
  }
}
