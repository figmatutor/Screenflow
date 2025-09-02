# 🐳 Docker Playwright Service 가이드

완전한 제어가 가능한 브라우저 자동화 서비스

## 📋 목차

- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [아키텍처](#아키텍처)
- [API 문서](#api-문서)
- [개발 환경](#개발-환경)
- [프로덕션 배포](#프로덕션-배포)
- [모니터링](#모니터링)
- [트러블슈팅](#트러블슈팅)

## 🎯 개요

Docker 기반 Playwright 서비스는 다음과 같은 장점을 제공합니다:

### ✅ **장점**
- **완전한 제어**: 브라우저 환경을 완전히 제어
- **확장성**: 여러 브라우저 인스턴스 동시 실행
- **안정성**: 격리된 환경에서 안전한 실행
- **모니터링**: Prometheus + Grafana 통합
- **성능**: 브라우저 인스턴스 재사용으로 빠른 응답

### 🏗️ **아키텍처**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│  Nginx Proxy    │───▶│ Playwright API  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐              │
                       │     Redis       │◀─────────────┘
                       │   (Caching)     │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Monitoring    │
                       │ (Prometheus +   │
                       │   Grafana)      │
                       └─────────────────┘
```

## 🚀 빠른 시작

### 1. 사전 요구사항
```bash
# Docker 및 Docker Compose 설치 확인
docker --version
docker-compose --version
```

### 2. 자동 설정 (권장)
```bash
# 전체 환경 자동 설정
./scripts/docker-setup.sh
```

### 3. 수동 설정
```bash
# 1. 환경변수 설정
cp .env.example .env.docker

# 2. Docker 이미지 빌드
docker-compose build

# 3. 서비스 시작
docker-compose up -d

# 4. 헬스체크
curl http://localhost:3001/health
```

### 4. 테스트
```bash
# 테스트 스크린샷 캡처
curl -X POST http://localhost:3001/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "width": 1920,
      "height": 1080,
      "format": "png"
    }
  }'
```

## 📡 API 문서

### 🖼️ 스크린샷 캡처
```http
POST /screenshot
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "browser": "chromium",        // chromium, firefox, webkit
    "width": 1920,               // 100-4000
    "height": 1080,              // 100-4000
    "deviceScaleFactor": 1,      // 0.1-3
    "fullPage": false,           // 전체 페이지 캡처
    "format": "png",             // png, jpeg
    "quality": 90,               // 1-100 (jpeg만)
    "timeout": 30000,            // 1000-60000ms
    "waitUntil": "networkidle",  // load, domcontentloaded, networkidle
    "delay": 0,                  // 0-10000ms
    "waitForSelector": ".content", // CSS 선택자
    "animations": "disabled",     // disabled, allow
    "colorScheme": "light"       // light, dark, no-preference
  }
}
```

**응답:**
```json
{
  "success": true,
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "metadata": {
    "url": "https://example.com",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "duration": 2500,
    "browser": "chromium",
    "viewport": { "width": 1920, "height": 1080 },
    "format": "png",
    "size": 245760
  }
}
```

### 📦 배치 스크린샷
```http
POST /screenshot/batch
Content-Type: application/json

{
  "urls": [
    "https://example.com",
    "https://google.com",
    "https://github.com"
  ],
  "options": {
    "width": 1200,
    "height": 800,
    "format": "jpeg",
    "quality": 80
  }
}
```

### 🔍 브라우저 상태
```http
GET /browsers
```

### 💓 헬스체크
```http
GET /health
```

## 🛠️ 개발 환경

### 개발 도구 사용
```bash
# 개발 환경 시작
./scripts/docker-dev.sh start

# 실시간 로그 확인
./scripts/docker-dev.sh logs

# 테스트 실행
./scripts/docker-dev.sh test

# 서비스 상태 확인
./scripts/docker-dev.sh status
```

### 디버깅
```bash
# 컨테이너 내부 접근
docker exec -it screenflow-playwright bash

# Node.js 디버깅 (포트 9229)
node --inspect=0.0.0.0:9229 server.js
```

### 코드 수정
```bash
# 코드 변경 후 재빌드
./scripts/docker-dev.sh build

# 서비스 재시작
./scripts/docker-dev.sh restart
```

## 🚀 프로덕션 배포

### Docker Swarm
```bash
# Swarm 모드 초기화
docker swarm init

# 스택 배포
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml screenflow
```

### Kubernetes
```yaml
# k8s/playwright-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: playwright-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: playwright-service
  template:
    metadata:
      labels:
        app: playwright-service
    spec:
      containers:
      - name: playwright
        image: screenflow/playwright-service:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### 환경변수 설정
```bash
# 프로덕션 환경변수
export NODE_ENV=production
export MAX_BROWSERS=5
export RATE_LIMIT_POINTS=20
export ALLOWED_ORIGINS=https://screenflow.pro
```

## 📊 모니터링

### Grafana 대시보드
- **URL**: http://localhost:3002
- **로그인**: admin / admin123
- **대시보드**: Playwright Service Metrics

### 주요 메트릭
- 요청 수 및 응답 시간
- 브라우저 인스턴스 수
- 메모리 사용량
- 에러율

### Prometheus 쿼리 예시
```promql
# 평균 응답 시간
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# 에러율
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# 활성 브라우저 수
browser_instances_active
```

## 🔧 설정 옵션

### 환경변수
```bash
# 서비스 설정
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://screenflow.pro

# 브라우저 설정
MAX_BROWSERS=3
BROWSER_TIMEOUT=300000

# Rate Limiting
RATE_LIMIT_POINTS=10
RATE_LIMIT_DURATION=60

# 보안
API_KEY_REQUIRED=false
TRUSTED_IPS=127.0.0.1,172.20.0.0/16
```

### Nginx 설정
```nginx
# Rate Limiting
limit_req_zone $binary_remote_addr zone=screenshot_limit:10m rate=10r/m;

# 타임아웃 설정
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

## 🚨 트러블슈팅

### 일반적인 문제

#### 1. 브라우저 실행 실패
```bash
# 해결: 권한 및 의존성 확인
docker exec -it screenflow-playwright bash
apt-get update && apt-get install -y libnss3 libatk-bridge2.0-0
```

#### 2. 메모리 부족
```bash
# 해결: 메모리 제한 증가
docker-compose up -d --scale playwright-service=1
```

#### 3. 네트워크 연결 문제
```bash
# 해결: 네트워크 설정 확인
docker network ls
docker network inspect screenflow_screenflow-network
```

### 로그 분석
```bash
# 서비스 로그
docker-compose logs -f playwright-service

# 시스템 로그
docker exec -it screenflow-playwright journalctl -f
```

### 성능 최적화
```bash
# 브라우저 인스턴스 수 조정
export MAX_BROWSERS=5

# 메모리 제한 설정
docker-compose up -d --memory=2g playwright-service
```

## 📚 추가 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Docker 공식 문서](https://docs.docker.com/)
- [Nginx 설정 가이드](https://nginx.org/en/docs/)
- [Prometheus 모니터링](https://prometheus.io/docs/)

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이센스

MIT License - 자세한 내용은 LICENSE 파일을 참조하세요.
