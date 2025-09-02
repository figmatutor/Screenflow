# 🎭 Playwright Docker Service
# 완전한 브라우저 환경을 포함한 스크린샷 서비스

FROM mcr.microsoft.com/playwright:v1.40.0-focal

# 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 설치
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# 작업 디렉토리 설정
WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# Playwright 브라우저 설치 (모든 브라우저)
RUN npx playwright install --with-deps chromium firefox webkit

# 애플리케이션 코드 복사
COPY . .

# 비root 사용자 생성 (보안)
RUN groupadd -r playwright && useradd -r -g playwright -G audio,video playwright \
    && mkdir -p /home/playwright/Downloads \
    && chown -R playwright:playwright /home/playwright \
    && chown -R playwright:playwright /app

# 사용자 전환
USER playwright

# 포트 노출
EXPOSE 3001

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 서비스 시작
CMD ["node", "server.js"]
