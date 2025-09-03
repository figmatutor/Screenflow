// 🔒 ScreenFlow Desktop - Preload Script (Security Bridge)
const { contextBridge, ipcRenderer } = require('electron');

// 안전한 API를 렌더러 프로세스에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 파일 시스템
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  saveFile: (filePath, data, encoding) => ipcRenderer.invoke('save-file', filePath, data, encoding),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  
  // 플랫폼 정보
  platform: process.platform,
  isElectron: true,
  
  // 버전 정보
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// 개발 환경에서만 추가 디버깅 정보
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('electronDev', {
    openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
    reload: () => ipcRenderer.invoke('reload-window')
  });
}

console.log('[ScreenFlow] Preload script loaded - API bridge ready');
