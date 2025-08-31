/** @type {import('next').NextConfig} */
const nextConfig = {
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
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'playwright',
    '@playwright/test',
  ],
};

module.exports = nextConfig;
