# Railway용 브라우저 서비스 Dockerfile
FROM node:18-slim

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Chrome 설치
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# Playwright 브라우저 설치
RUN npx playwright install chromium firefox webkit
RUN npx playwright install-deps

# 애플리케이션 코드 복사
COPY . .

# 비root 사용자 생성
RUN groupadd -r browseruser && useradd -r -g browseruser -G audio,video browseruser \
    && mkdir -p /home/browseruser/Downloads \
    && chown -R browseruser:browseruser /home/browseruser \
    && chown -R browseruser:browseruser /app

# 포트 설정
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 사용자 변경
USER browseruser

# 애플리케이션 실행
CMD ["node", "server.js"]
