'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugSupabase() {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const checkSupabase = async () => {
      const info: any = {
        clientExists: !!supabase,
        envVars: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
        },
        timestamp: new Date().toISOString()
      };

      if (supabase) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          info.session = {
            exists: !!session,
            user: session?.user?.email,
            error: error?.message
          };
        } catch (err) {
          info.sessionError = err instanceof Error ? err.message : 'Unknown error';
        }
      }

      setDebugInfo(info);
      console.log('[Debug Supabase] 상태 정보:', info);
    };

    checkSupabase();
  }, []);

  if (!debugInfo) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">🔍 Supabase Debug</h3>
      <div className="space-y-1">
        <div>Client: {debugInfo.clientExists ? '✅' : '❌'}</div>
        <div>URL: {debugInfo.envVars.url ? '✅' : '❌'}</div>
        <div>Anon Key: {debugInfo.envVars.hasAnonKey ? '✅' : '❌'} ({debugInfo.envVars.anonKeyLength})</div>
        {debugInfo.session && (
          <div>Session: {debugInfo.session.exists ? '✅' : '❌'}</div>
        )}
        {debugInfo.sessionError && (
          <div className="text-red-400">Error: {debugInfo.sessionError}</div>
        )}
      </div>
    </div>
  );
}
