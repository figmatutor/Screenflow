// 🖥️ ScreenFlow Desktop - Electron Main Process
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 개발 환경 확인
const isDev = process.env.NODE_ENV === 'development';

// 포트 동적 감지 함수
async function findAvailablePort() {
  const testPorts = [3002, 3001, 3000, 3003, 3004]; // 3002를 먼저 시도
  
  console.log('[ScreenFlow] 포트 스캔 시작...');
  
  for (const port of testPorts) {
    try {
      console.log(`[ScreenFlow] 포트 ${port} 테스트 중...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
      
      const response = await fetch(`http://localhost:${port}`, { 
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ScreenFlow-Electron/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`[ScreenFlow] ✅ 활성 포트 발견: ${port} (상태: ${response.status})`);
        return port;
      } else {
        console.log(`[ScreenFlow] ❌ 포트 ${port} 응답 오류: ${response.status}`);
      }
    } catch (error) {
      console.log(`[ScreenFlow] ❌ 포트 ${port} 연결 실패: ${error.message}`);
      continue;
    }
  }
  
  // 기본값 반환
  console.warn('[ScreenFlow] ⚠️ 활성 포트를 찾을 수 없음, 기본값 3002 사용');
  return 3002; // 기본값을 3002로 변경
}

// 메인 윈도우 참조
let mainWindow;

// 앱 설정
const APP_CONFIG = {
  name: 'ScreenFlow Desktop',
  version: '1.0.0',
  description: '로컬 스크린샷 캡처 및 자동화 도구',
  defaultDownloadPath: path.join(os.homedir(), 'Downloads', 'ScreenFlow')
};

// 다운로드 폴더 생성
function ensureDownloadDirectory() {
  if (!fs.existsSync(APP_CONFIG.defaultDownloadPath)) {
    fs.mkdirSync(APP_CONFIG.defaultDownloadPath, { recursive: true });
    console.log(`[ScreenFlow] 다운로드 폴더 생성: ${APP_CONFIG.defaultDownloadPath}`);
  }
}

// 메인 윈도우 생성
async function createMainWindow() {
  console.log('[ScreenFlow] 메인 윈도우 생성 중...');
  
  // 개발 환경에서 포트 동적 감지
  let port = 3001;
  if (isDev) {
    port = await findAvailablePort();
    console.log(`[ScreenFlow] 사용할 포트: ${port}`);
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev // 개발 환경에서는 CORS 비활성화
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // 아이콘 추가 예정
    titleBarStyle: 'default',
    show: false, // 준비될 때까지 숨김
    backgroundColor: '#ffffff'
  });

  // 로드할 URL 결정
  const startUrl = isDev 
    ? `http://localhost:${port}/desktop` 
    : `file://${path.join(__dirname, '../out/index.html')}`;

  console.log(`[ScreenFlow] 로딩 URL: ${startUrl}`);
  
  // 페이지 로드
  mainWindow.loadURL(startUrl);

  // 개발 환경에서는 DevTools 자동 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    console.log('[ScreenFlow] 윈도우 표시');
    mainWindow.show();
    
    // 포커스 설정
    if (isDev) {
      mainWindow.focus();
    }
  });

  // 윈도우 닫기 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 네비게이션 제어
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 외부 URL로의 네비게이션 방지 (개발 환경에서는 localhost 허용)
    if (isDev) {
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      if (!isLocalhost) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } else {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
}

// 애플리케이션 메뉴 설정
function createApplicationMenu() {
  const template = [
    {
      label: 'ScreenFlow',
      submenu: [
        {
          label: '정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ScreenFlow Desktop 정보',
              message: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
              detail: APP_CONFIG.description,
              buttons: ['확인']
            });
          }
        },
        { type: 'separator' },
        {
          label: '환경설정',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // 환경설정 창 열기 (추후 구현)
            console.log('[ScreenFlow] 환경설정 열기');
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '파일',
      submenu: [
        {
          label: '다운로드 폴더 열기',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            shell.openPath(APP_CONFIG.defaultDownloadPath);
          }
        },
        {
          label: '다운로드 폴더 변경',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '다운로드 폴더 선택',
              defaultPath: APP_CONFIG.defaultDownloadPath,
              properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              APP_CONFIG.defaultDownloadPath = result.filePaths[0];
              console.log(`[ScreenFlow] 다운로드 폴더 변경: ${APP_CONFIG.defaultDownloadPath}`);
            }
          }
        }
      ]
    },
    {
      label: '도구',
      submenu: [
        {
          label: '개발자 도구',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          }
        }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: 'GitHub 저장소',
          click: () => {
            shell.openExternal('https://github.com/figmatutor/Screenflow');
          }
        },
        {
          label: '문제 신고',
          click: () => {
            shell.openExternal('https://github.com/figmatutor/Screenflow/issues');
          }
        }
      ]
    }
  ];

  // macOS에서는 첫 번째 메뉴가 앱 이름으로 자동 설정됨
  if (process.platform === 'darwin') {
    template[0].label = app.getName();
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 핸들러 설정
function setupIpcHandlers() {
  // 다운로드 폴더 경로 반환
  ipcMain.handle('get-download-path', () => {
    return APP_CONFIG.defaultDownloadPath;
  });

  // 파일 저장 대화상자
  ipcMain.handle('save-file-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '파일 저장',
      defaultPath: path.join(APP_CONFIG.defaultDownloadPath, options.defaultName || 'screenshot.png'),
      filters: [
        { name: 'PNG 이미지', extensions: ['png'] },
        { name: 'JPEG 이미지', extensions: ['jpg', 'jpeg'] },
        { name: 'ZIP 파일', extensions: ['zip'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    });

    return result;
  });

  // 파일 저장
  ipcMain.handle('save-file', async (event, filePath, data, encoding = 'base64') => {
    try {
      // base64 데이터에서 헤더 제거
      const base64Data = data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // 파일 저장
      fs.writeFileSync(filePath, base64Data, encoding);
      
      console.log(`[ScreenFlow] 파일 저장 완료: ${filePath}`);
      return { success: true, path: filePath };
    } catch (error) {
      console.error(`[ScreenFlow] 파일 저장 실패:`, error);
      return { success: false, error: error.message };
    }
  });

  // 폴더 열기
  ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      console.error(`[ScreenFlow] 폴더 열기 실패:`, error);
      return { success: false, error: error.message };
    }
  });

  // 앱 정보 반환
  ipcMain.handle('get-app-info', () => {
    return {
      name: APP_CONFIG.name,
      version: APP_CONFIG.version,
      description: APP_CONFIG.description,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node
    };
  });
}

// 앱 이벤트 핸들러
app.whenReady().then(async () => {
  console.log('[ScreenFlow] Electron 앱 준비 완료');
  
  ensureDownloadDirectory();
  await createMainWindow();
  createApplicationMenu();
  setupIpcHandlers();

  // macOS에서 독에서 클릭 시 윈도우 재생성
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

// 모든 윈도우가 닫혔을 때
app.on('window-all-closed', () => {
  // macOS가 아닌 경우 앱 종료
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱 종료 전 정리 작업
app.on('before-quit', () => {
  console.log('[ScreenFlow] 앱 종료 중...');
});

// 보안: 새 윈도우 생성 방지
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

console.log(`[ScreenFlow] Electron 메인 프로세스 시작 (개발 모드: ${isDev})`);
