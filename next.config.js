/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Electron 빌드를 위한 정적 내보내기 설정
  output: process.env.NODE_ENV === 'production' && process.env.BUILD_ELECTRON ? 'export' : undefined,
  trailingSlash: true,
  distDir: 'out',
  // Supabase functions와 Docker 관련 파일들을 빌드에서 제외
  webpack: (config, { isServer }) => {
    // TypeScript 컴파일에서 특정 디렉토리 제외
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: [
        /node_modules/,
        /supabase\/functions/,
        /docker/,
        /scripts/
      ],
    });

    if (!isServer) {
      // 클라이언트 사이드에서 Node.js 전용 모듈들을 false로 설정
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        crypto: false,
        http: false,
        https: false,
        os: false,
        path: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        url: false,
        querystring: false,
        zlib: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },

  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'playwright',
    '@playwright/test',
  ],
};

module.exports = nextConfig;
