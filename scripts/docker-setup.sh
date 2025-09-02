#!/bin/bash
# 🐳 Docker Playwright Service 설정 스크립트

set -e

echo "🎭 ScreenFlow Docker Playwright Service Setup"
echo "============================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
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

# Docker 설치 확인
check_docker() {
    log_info "Docker 설치 확인 중..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        log_info "Docker 설치: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        log_info "Docker Compose 설치: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    log_success "Docker 및 Docker Compose 확인 완료"
}

# 디렉토리 생성
create_directories() {
    log_info "필요한 디렉토리 생성 중..."
    
    mkdir -p screenshots
    mkdir -p logs
    mkdir -p docker/nginx/ssl
    mkdir -p docker/monitoring/grafana/dashboards
    mkdir -p docker/monitoring/grafana/datasources
    
    log_success "디렉토리 생성 완료"
}

# 환경변수 파일 생성
create_env_files() {
    log_info "환경변수 파일 생성 중..."
    
    # Docker 환경변수
    if [ ! -f .env.docker ]; then
        cat > .env.docker << EOF
# 🐳 Docker Playwright Service Environment Variables

# Service Configuration
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://screenflow.pro

# Browser Configuration
MAX_BROWSERS=3
BROWSER_TIMEOUT=300000

# Rate Limiting
RATE_LIMIT_POINTS=10
RATE_LIMIT_DURATION=60

# Monitoring
ENABLE_PROMETHEUS=true
PROMETHEUS_PORT=9090
GRAFANA_PORT=3002

# Security
API_KEY_REQUIRED=false
TRUSTED_IPS=127.0.0.1,172.20.0.0/16

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
EOF
        log_success ".env.docker 파일 생성 완료"
    else
        log_warning ".env.docker 파일이 이미 존재합니다."
    fi

    # Next.js 환경변수 업데이트
    if [ -f .env.local ]; then
        if ! grep -q "NEXT_PUBLIC_PLAYWRIGHT_SERVICE_URL" .env.local; then
            echo "" >> .env.local
            echo "# 🎭 Docker Playwright Service" >> .env.local
            echo "NEXT_PUBLIC_PLAYWRIGHT_SERVICE_URL=http://localhost:3001" >> .env.local
            log_success ".env.local에 Playwright 서비스 URL 추가"
        fi
    else
        log_warning ".env.local 파일이 없습니다. 수동으로 생성해주세요."
    fi
}

# Prometheus 설정
create_prometheus_config() {
    log_info "Prometheus 설정 생성 중..."
    
    mkdir -p docker/monitoring
    
    cat > docker/monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'playwright-service'
    static_configs:
      - targets: ['playwright-service:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF
    
    log_success "Prometheus 설정 완료"
}

# Grafana 데이터소스 설정
create_grafana_config() {
    log_info "Grafana 설정 생성 중..."
    
    mkdir -p docker/monitoring/grafana/datasources
    
    cat > docker/monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF
    
    log_success "Grafana 설정 완료"
}

# Docker 이미지 빌드
build_images() {
    log_info "Docker 이미지 빌드 중..."
    
    # Playwright 서비스 빌드
    docker-compose build playwright-service
    
    log_success "Docker 이미지 빌드 완료"
}

# 서비스 시작
start_services() {
    log_info "Docker 서비스 시작 중..."
    
    # 백그라운드에서 서비스 시작
    docker-compose up -d
    
    log_success "Docker 서비스 시작 완료"
    
    # 서비스 상태 확인
    log_info "서비스 상태 확인 중..."
    sleep 10
    
    docker-compose ps
}

# 헬스체크
health_check() {
    log_info "서비스 헬스체크 중..."
    
    # Playwright 서비스 체크
    for i in {1..30}; do
        if curl -f http://localhost:3001/health &> /dev/null; then
            log_success "Playwright 서비스 정상 작동"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "Playwright 서비스 헬스체크 실패"
            docker-compose logs playwright-service
            exit 1
        fi
        
        log_info "헬스체크 대기 중... ($i/30)"
        sleep 2
    done
    
    # 테스트 스크린샷
    log_info "테스트 스크린샷 캡처 중..."
    
    test_response=$(curl -s -X POST http://localhost:3001/screenshot \
        -H "Content-Type: application/json" \
        -d '{
            "url": "https://example.com",
            "options": {
                "width": 800,
                "height": 600,
                "format": "png"
            }
        }')
    
    if echo "$test_response" | grep -q '"success":true'; then
        log_success "테스트 스크린샷 캡처 성공"
    else
        log_error "테스트 스크린샷 캡처 실패"
        echo "$test_response"
    fi
}

# 사용법 출력
show_usage() {
    echo ""
    log_success "🎉 Docker Playwright Service 설정 완료!"
    echo ""
    echo "📋 사용 가능한 서비스:"
    echo "  • Playwright Service: http://localhost:3001"
    echo "  • Health Check: http://localhost:3001/health"
    echo "  • Browser Status: http://localhost:3001/browsers"
    echo "  • Grafana Monitoring: http://localhost:3002 (admin/admin123)"
    echo "  • Prometheus: http://localhost:9090"
    echo ""
    echo "🔧 유용한 명령어:"
    echo "  • 서비스 중지: docker-compose down"
    echo "  • 로그 확인: docker-compose logs -f playwright-service"
    echo "  • 서비스 재시작: docker-compose restart playwright-service"
    echo "  • 이미지 재빌드: docker-compose build --no-cache playwright-service"
    echo ""
    echo "📖 API 사용 예시:"
    echo "  curl -X POST http://localhost:3001/screenshot \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"url\": \"https://example.com\", \"options\": {\"width\": 1920, \"height\": 1080}}'"
    echo ""
}

# 메인 실행
main() {
    log_info "Docker Playwright Service 설정을 시작합니다..."
    
    check_docker
    create_directories
    create_env_files
    create_prometheus_config
    create_grafana_config
    build_images
    start_services
    health_check
    show_usage
    
    log_success "모든 설정이 완료되었습니다! 🚀"
}

# 스크립트 실행
main "$@"
