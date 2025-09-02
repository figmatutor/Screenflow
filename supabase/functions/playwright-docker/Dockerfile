# Playwright를 위한 커스텀 Docker 이미지
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Deno 설치
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV PATH="/root/.deno/bin:$PATH"

# 작업 디렉토리 설정
WORKDIR /app

# Playwright 브라우저 설치
RUN npx playwright install chromium

# 함수 파일 복사
COPY . .

# 포트 노출
EXPOSE 8000

# Deno로 함수 실행
CMD ["deno", "run", "--allow-all", "index.ts"]
