// 🖥️ Electron 환경 유틸리티
// 웹과 데스크톱 환경을 구분하여 처리

// Electron API 타입 정의
interface ElectronAPI {
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    description: string;
    platform: string;
    arch: string;
    electronVersion: string;
    nodeVersion: string;
  }>;
  getDownloadPath: () => Promise<string>;
  saveFileDialog: (options: {
    defaultName?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{
    canceled: boolean;
    filePath?: string;
  }>;
  saveFile: (filePath: string, data: string, encoding?: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  openFolder: (folderPath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  platform: string;
  isElectron: boolean;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Electron 환경 확인
export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
}

// 플랫폼 정보 가져오기
export function getPlatformInfo(): string {
  if (isElectronEnvironment()) {
    return window.electronAPI!.platform;
  }
  return 'web';
}

// 앱 정보 가져오기
export async function getAppInfo() {
  if (isElectronEnvironment()) {
    return await window.electronAPI!.getAppInfo();
  }
  
  return {
    name: 'ScreenFlow Web',
    version: '1.0.0',
    description: '웹 기반 스크린샷 캡처 도구',
    platform: 'web',
    arch: 'unknown',
    electronVersion: 'N/A',
    nodeVersion: 'N/A'
  };
}

// 파일 다운로드 (Electron vs Web)
export async function downloadFile(
  data: string, 
  filename: string, 
  mimeType: string = 'image/png'
): Promise<{ success: boolean; path?: string; error?: string }> {
  
  if (isElectronEnvironment()) {
    // Electron 환경: 네이티브 파일 저장 대화상자
    try {
      const saveResult = await window.electronAPI!.saveFileDialog({
        defaultName: filename,
        filters: getFileFilters(mimeType)
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, error: '사용자가 취소했습니다.' };
      }

      const saveFileResult = await window.electronAPI!.saveFile(
        saveResult.filePath,
        data,
        'base64'
      );

      if (saveFileResult.success) {
        console.log(`[ElectronUtils] 파일 저장 성공: ${saveFileResult.path}`);
        return { success: true, path: saveFileResult.path };
      } else {
        return { success: false, error: saveFileResult.error };
      }
    } catch (error) {
      console.error('[ElectronUtils] 파일 저장 실패:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  } else {
    // 웹 환경: 브라우저 다운로드
    try {
      const link = document.createElement('a');
      link.href = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`[ElectronUtils] 웹 다운로드 완료: ${filename}`);
      return { success: true, path: filename };
    } catch (error) {
      console.error('[ElectronUtils] 웹 다운로드 실패:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// ZIP 파일 다운로드
export async function downloadZipFile(
  zipBlob: Blob, 
  filename: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  
  if (isElectronEnvironment()) {
    // Blob을 base64로 변환
    const base64Data = await blobToBase64(zipBlob);
    return downloadFile(base64Data, filename, 'application/zip');
  } else {
    // 웹 환경: Blob URL 사용
    try {
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`[ElectronUtils] ZIP 웹 다운로드 완료: ${filename}`);
      return { success: true, path: filename };
    } catch (error) {
      console.error('[ElectronUtils] ZIP 웹 다운로드 실패:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// 다운로드 폴더 열기
export async function openDownloadFolder(): Promise<{ success: boolean; error?: string }> {
  if (isElectronEnvironment()) {
    try {
      const downloadPath = await window.electronAPI!.getDownloadPath();
      return await window.electronAPI!.openFolder(downloadPath);
    } catch (error) {
      console.error('[ElectronUtils] 폴더 열기 실패:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  } else {
    // 웹 환경에서는 다운로드 폴더를 직접 열 수 없음
    return { 
      success: false, 
      error: '웹 환경에서는 폴더를 직접 열 수 없습니다.' 
    };
  }
}

// 클립보드에 복사 (크로스 플랫폼)
export async function copyToClipboard(data: string, type: 'text' | 'image' = 'text'): Promise<boolean> {
  try {
    if (type === 'image' && data.startsWith('data:image/')) {
      // 이미지 데이터를 클립보드에 복사
      const response = await fetch(data);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      
      console.log('[ElectronUtils] 이미지 클립보드 복사 완료');
      return true;
    } else {
      // 텍스트 데이터 복사
      await navigator.clipboard.writeText(data);
      console.log('[ElectronUtils] 텍스트 클립보드 복사 완료');
      return true;
    }
  } catch (error) {
    console.error('[ElectronUtils] 클립보드 복사 실패:', error);
    return false;
  }
}

// 유틸리티 함수들
function getFileFilters(mimeType: string) {
  const filters = [
    { name: '모든 파일', extensions: ['*'] }
  ];

  if (mimeType.includes('image/png')) {
    filters.unshift({ name: 'PNG 이미지', extensions: ['png'] });
  } else if (mimeType.includes('image/jpeg')) {
    filters.unshift({ name: 'JPEG 이미지', extensions: ['jpg', 'jpeg'] });
  } else if (mimeType.includes('application/zip')) {
    filters.unshift({ name: 'ZIP 파일', extensions: ['zip'] });
  }

  return filters;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:application/zip;base64, 부분 제거
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 환경별 설정
export const ENVIRONMENT_CONFIG = {
  isElectron: isElectronEnvironment(),
  platform: getPlatformInfo(),
  supportsNativeFileDialog: isElectronEnvironment(),
  supportsDirectoryAccess: isElectronEnvironment(),
  supportsClipboardImage: true // 모든 환경에서 지원
};

console.log('[ElectronUtils] 환경 설정:', ENVIRONMENT_CONFIG);
