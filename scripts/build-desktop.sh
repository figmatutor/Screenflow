#!/bin/bash
# 🖥️ ScreenFlow Desktop 빌드 스크립트

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🖥️ ScreenFlow Desktop 빌드 시작"
echo "================================="

# 1. 의존성 확인
log_info "의존성 확인 중..."
if ! command -v node &> /dev/null; then
    log_error "Node.js가 설치되지 않았습니다."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm이 설치되지 않았습니다."
    exit 1
fi

log_success "Node.js $(node --version) 및 npm $(npm --version) 확인됨"

# 2. 패키지 설치
log_info "패키지 설치 중..."
npm install
log_success "패키지 설치 완료"

# 3. Next.js 정적 빌드
log_info "Next.js 정적 빌드 중..."
BUILD_ELECTRON=true npm run build
log_success "Next.js 빌드 완료"

# 4. Electron 패키징
log_info "Electron 앱 패키징 중..."
npm run dist
log_success "Electron 패키징 완료"

# 5. 결과 확인
log_info "빌드 결과 확인 중..."
if [ -d "dist" ]; then
    echo ""
    log_success "🎉 빌드 완료!"
    echo ""
    echo "📦 생성된 파일들:"
    ls -la dist/
    echo ""
    echo "📍 설치 파일 위치:"
    find dist/ -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" 2>/dev/null | head -5
    echo ""
    echo "🚀 사용법:"
    echo "  - macOS: dist/ 폴더에서 .dmg 파일 실행"
    echo "  - Windows: dist/ 폴더에서 .exe 파일 실행"  
    echo "  - Linux: dist/ 폴더에서 .AppImage 파일 실행"
else
    log_error "빌드 실패: dist 폴더가 생성되지 않았습니다."
    exit 1
fi

echo ""
log_success "ScreenFlow Desktop 빌드가 성공적으로 완료되었습니다! 🎉"
