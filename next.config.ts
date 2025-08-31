import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
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
  turbo: {
    // Turbopack용 설정
    resolveAlias: {
      // Node.js 모듈들을 false로 매핑 (클라이언트에서 사용 방지)
      net: false,
      tls: false,
      dns: false,
      fs: false,
      os: false,
      crypto: false,
      http: false,
      https: false,
    },
  },
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'playwright',
    '@playwright/test',
  ],
};

export default nextConfig;
