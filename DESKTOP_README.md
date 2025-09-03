# 🖥️ ScreenFlow Desktop

로컬에서 사용할 수 있는 데스크톱 버전의 ScreenFlow 스크린샷 캡처 및 자동화 도구입니다.

## ✨ 주요 기능

### 🎯 **웹 기반 기능을 데스크톱으로**
- ✅ 자동 스크린샷 캡처 및 크롤링
- ✅ 다중 페이지 동시 처리
- ✅ 실시간 진행 상황 모니터링
- ✅ 통합 폴링 시스템으로 안정적인 세션 관리

### 🖥️ **데스크톱 전용 기능**
- ✅ **로컬 파일 저장**: 네이티브 파일 저장 대화상자
- ✅ **폴더 직접 열기**: 다운로드 폴더 바로 접근
- ✅ **오프라인 사용**: 인터넷 연결 없이도 기본 기능 사용
- ✅ **시스템 통합**: OS별 최적화된 UI/UX
- ✅ **자동 업데이트**: 새 버전 자동 감지 및 설치

## 🚀 빠른 시작

### 1. **개발 환경에서 실행**
```bash
# 의존성 설치
npm install

# 개발 모드로 Electron 앱 실행
npm run electron:dev
```

### 2. **프로덕션 빌드**
```bash
# 자동 빌드 스크립트 실행
./scripts/build-desktop.sh

# 또는 수동 빌드
npm run build
npm run dist
```

### 3. **설치 파일 생성**
빌드 완료 후 `dist/` 폴더에서 OS별 설치 파일을 찾을 수 있습니다:

- **macOS**: `ScreenFlow Desktop-1.0.0.dmg`
- **Windows**: `ScreenFlow Desktop Setup 1.0.0.exe`
- **Linux**: `ScreenFlow Desktop-1.0.0.AppImage`

## 📋 시스템 요구사항

### **최소 요구사항**
- **OS**: macOS 10.14+, Windows 10+, Ubuntu 18.04+
- **RAM**: 4GB 이상
- **저장공간**: 500MB 이상
- **네트워크**: 인터넷 연결 (캡처 기능 사용 시)

### **권장 요구사항**
- **OS**: macOS 12+, Windows 11+, Ubuntu 20.04+
- **RAM**: 8GB 이상
- **저장공간**: 2GB 이상
- **네트워크**: 고속 인터넷 연결

## 🎨 사용법

### **1. 자동 캡처**
1. 앱 실행 후 URL 입력
2. "자동 캡처 시작" 버튼 클릭
3. 실시간으로 진행 상황 확인
4. 완료 후 원하는 파일 선택하여 다운로드

### **2. 파일 관리**
- **개별 다운로드**: 각 이미지별로 저장
- **일괄 다운로드**: 선택한 파일들을 ZIP으로 압축
- **클립보드 복사**: 이미지를 클립보드에 직접 복사
- **폴더 열기**: 다운로드 폴더 바로 접근

### **3. 환경설정**
- **다운로드 폴더 변경**: 메뉴 → 파일 → 다운로드 폴더 변경
- **개발자 도구**: 메뉴 → 도구 → 개발자 도구 (디버깅용)

## 🔧 개발자 가이드

### **프로젝트 구조**
```
├── electron/                 # Electron 메인 프로세스
│   ├── main.js              # 메인 프로세스 엔트리포인트
│   └── preload.js           # 보안 브리지 스크립트
├── src/
│   ├── components/desktop/   # 데스크톱 전용 컴포넌트
│   ├── lib/electron-utils.ts # Electron 유틸리티
│   └── app/desktop/         # 데스크톱 전용 페이지
├── scripts/
│   └── build-desktop.sh     # 빌드 자동화 스크립트
└── dist/                    # 빌드 결과물
```

### **주요 기술 스택**
- **Electron**: 데스크톱 앱 프레임워크
- **Next.js**: React 기반 웹 프레임워크
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Electron Builder**: 패키징 및 배포

### **빌드 설정**
```json
{
  "build": {
    "appId": "com.screenflow.desktop",
    "productName": "ScreenFlow Desktop",
    "directories": {
      "output": "dist"
    },
    "files": [
      "out/**/*",
      "electron/**/*",
      "node_modules/**/*"
    ]
  }
}
```

## 🔒 보안

### **샌드박스 모드**
- Context Isolation 활성화
- Node Integration 비활성화
- 안전한 IPC 통신만 허용

### **권한 관리**
- 파일 시스템 접근: 사용자 승인 후에만
- 네트워크 접근: 필요한 도메인만
- 외부 링크: 기본 브라우저에서 열기

## 📦 배포

### **자동 배포**
```bash
# GitHub Actions를 통한 자동 빌드 (설정 예정)
git tag v1.0.0
git push origin v1.0.0
```

### **수동 배포**
```bash
# 로컬에서 빌드 후 배포
npm run dist
# dist/ 폴더의 파일들을 배포 서버에 업로드
```

## 🐛 문제 해결

### **일반적인 문제**

#### **1. 앱이 실행되지 않음**
```bash
# 권한 확인 (macOS/Linux)
chmod +x "ScreenFlow Desktop.app"

# 보안 설정 확인 (macOS)
# 시스템 환경설정 → 보안 및 개인 정보 보호 → 일반
```

#### **2. 파일 저장 실패**
- 다운로드 폴더 권한 확인
- 충분한 디스크 공간 확인
- 바이러스 백신 소프트웨어 예외 설정

#### **3. 네트워크 오류**
- 방화벽 설정 확인
- 프록시 설정 확인
- DNS 설정 확인

### **로그 확인**
```bash
# 개발 모드에서 로그 확인
npm run electron:dev

# 프로덕션에서 로그 위치
# macOS: ~/Library/Logs/ScreenFlow Desktop/
# Windows: %USERPROFILE%\AppData\Roaming\ScreenFlow Desktop\logs\
# Linux: ~/.config/ScreenFlow Desktop/logs/
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이센스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🆘 지원

- **GitHub Issues**: [문제 신고](https://github.com/figmatutor/Screenflow/issues)
- **이메일**: support@screenflow.pro
- **문서**: [온라인 문서](https://docs.screenflow.pro)

---

**ScreenFlow Desktop v1.0.0** - 로컬에서 사용하는 강력한 스크린샷 캡처 도구 🚀
