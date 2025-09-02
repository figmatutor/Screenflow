#!/bin/bash
# 🛠️ Docker Playwright Service 개발 환경 스크립트

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

case "$1" in
    "start")
        log_info "개발 환경 시작 중..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
        log_success "개발 환경 시작 완료"
        ;;
    
    "stop")
        log_info "서비스 중지 중..."
        docker-compose down
        log_success "서비스 중지 완료"
        ;;
    
    "restart")
        log_info "서비스 재시작 중..."
        docker-compose restart playwright-service
        log_success "서비스 재시작 완료"
        ;;
    
    "logs")
        log_info "로그 확인 중..."
        docker-compose logs -f playwright-service
        ;;
    
    "build")
        log_info "이미지 재빌드 중..."
        docker-compose build --no-cache playwright-service
        log_success "이미지 재빌드 완료"
        ;;
    
    "test")
        log_info "테스트 스크린샷 캡처 중..."
        curl -X POST http://localhost:3001/screenshot \
            -H "Content-Type: application/json" \
            -d '{
                "url": "https://example.com",
                "options": {
                    "width": 1200,
                    "height": 800,
                    "format": "png",
                    "fullPage": false
                }
            }' | jq .
        ;;
    
    "health")
        log_info "헬스체크 실행 중..."
        curl -s http://localhost:3001/health | jq .
        ;;
    
    "status")
        log_info "서비스 상태 확인 중..."
        docker-compose ps
        echo ""
        curl -s http://localhost:3001/browsers | jq .
        ;;
    
    "clean")
        log_warning "모든 컨테이너 및 이미지 정리 중..."
        docker-compose down -v --rmi all
        docker system prune -f
        log_success "정리 완료"
        ;;
    
    *)
        echo "🐳 Docker Playwright Service 개발 도구"
        echo ""
        echo "사용법: $0 {start|stop|restart|logs|build|test|health|status|clean}"
        echo ""
        echo "명령어:"
        echo "  start   - 개발 환경 시작"
        echo "  stop    - 서비스 중지"
        echo "  restart - 서비스 재시작"
        echo "  logs    - 실시간 로그 확인"
        echo "  build   - 이미지 재빌드"
        echo "  test    - 테스트 스크린샷 캡처"
        echo "  health  - 헬스체크"
        echo "  status  - 서비스 상태 확인"
        echo "  clean   - 모든 컨테이너/이미지 정리"
        echo ""
        exit 1
        ;;
esac
