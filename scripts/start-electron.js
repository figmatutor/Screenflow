#!/usr/bin/env node
// 🚀 ScreenFlow Electron 시작 스크립트

const { spawn } = require('child_process');
const fetch = require('node-fetch');

// 포트 감지 함수
async function findNextJsPort() {
  const testPorts = [3002, 3001, 3000, 3003, 3004];
  
  console.log('🔍 Next.js 서버 포트 스캔 중...');
  
  for (const port of testPorts) {
    try {
      console.log(`   포트 ${port} 확인 중...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Next.js 서버 발견: http://localhost:${port}`);
        return port;
      }
    } catch (error) {
      // 포트가 응답하지 않으면 다음 포트 시도
      continue;
    }
  }
  
  throw new Error('활성화된 Next.js 서버를 찾을 수 없습니다.');
}

// 서버 대기 함수
async function waitForServer(maxAttempts = 30) {
  console.log('⏳ Next.js 서버 시작 대기 중...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const port = await findNextJsPort();
      console.log(`🎉 서버 준비 완료! (시도 ${attempt}/${maxAttempts})`);
      return port;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      console.log(`   시도 ${attempt}/${maxAttempts} - 2초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Electron 시작 함수
function startElectron() {
  console.log('🖥️ Electron 앱 시작 중...');
  
  const electronProcess = spawn('electron', ['electron/main.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  electronProcess.on('close', (code) => {
    console.log(`Electron 프로세스 종료 (코드: ${code})`);
    process.exit(code);
  });
  
  electronProcess.on('error', (error) => {
    console.error('Electron 시작 오류:', error);
    process.exit(1);
  });
  
  return electronProcess;
}

// 메인 실행 함수
async function main() {
  try {
    console.log('🚀 ScreenFlow Electron 시작');
    console.log('================================');
    
    // 1. Next.js 서버 대기
    const port = await waitForServer();
    
    // 2. 환경 변수 설정
    process.env.NEXT_SERVER_PORT = port.toString();
    
    // 3. Electron 시작
    const electronProcess = startElectron();
    
    // 4. 종료 시그널 처리
    process.on('SIGINT', () => {
      console.log('\n🛑 종료 신호 수신 - Electron 종료 중...');
      electronProcess.kill('SIGTERM');
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 종료 신호 수신 - Electron 종료 중...');
      electronProcess.kill('SIGTERM');
    });
    
  } catch (error) {
    console.error('❌ 시작 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}
