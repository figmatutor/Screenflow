'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [result, setResult] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(`[Debug] ${message}`);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testBasicJS = () => {
    addLog('JavaScript 기본 테스트 시작');
    try {
      const test = { a: 1, b: 2 };
      const json = JSON.stringify(test);
      addLog(`JSON 변환 성공: ${json}`);
      setResult('✅ JavaScript 기본 기능 정상');
    } catch (error) {
      addLog(`❌ JavaScript 기본 오류: ${error}`);
      setResult('❌ JavaScript 기본 기능 오류');
    }
  };

  const testFetch = async () => {
    addLog('Fetch API 테스트 시작');
    try {
      const response = await fetch('/api/health');
      addLog(`Response status: ${response.status}`);
      const data = await response.json();
      addLog(`Response data: ${JSON.stringify(data)}`);
      setResult('✅ Fetch API 정상');
    } catch (error) {
      addLog(`❌ Fetch 오류: ${error}`);
      setResult('❌ Fetch API 오류');
    }
  };

  const testFullFlow = async () => {
    addLog('전체 플로우 테스트 시작');
    try {
      // POST 요청
      const postResponse = await fetch('/api/auto-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://naver.com', options: {} })
      });
      addLog(`POST status: ${postResponse.status}`);
      const postData = await postResponse.json();
      addLog(`POST response: ${JSON.stringify(postData)}`);

      if (postData.sessionId) {
        // GET 요청
        const getResponse = await fetch(`/api/auto-capture?sessionId=${postData.sessionId}&v=2`);
        addLog(`GET status: ${getResponse.status}`);
        const getData = await getResponse.json();
        addLog(`GET response: ${JSON.stringify(getData)}`);
        setResult('✅ 전체 플로우 정상');
      } else {
        setResult('❌ 세션 ID 없음');
      }
    } catch (error) {
      addLog(`❌ 전체 플로우 오류: ${error}`);
      setResult('❌ 전체 플로우 오류');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔧 JavaScript 디버깅 페이지</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testBasicJS} style={{ marginRight: '10px', padding: '10px' }}>
          JavaScript 기본 테스트
        </button>
        <button onClick={testFetch} style={{ marginRight: '10px', padding: '10px' }}>
          Fetch API 테스트
        </button>
        <button onClick={testFullFlow} style={{ padding: '10px' }}>
          전체 플로우 테스트
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <strong>결과:</strong> {result}
      </div>

      <div>
        <h3>📋 실행 로그:</h3>
        <div style={{ backgroundColor: '#000', color: '#0f0', padding: '10px', height: '300px', overflow: 'auto' }}>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
