import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Screenflow',
  description: '레퍼런스 수집, 이제 링크 한 줄로 끝. 웹페이지를 자동으로 크롤링하고 스크린샷을 캡처하여 레퍼런스를 쉽게 수집하세요.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1.5,
    minimumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b16' }
  ],
  colorScheme: 'dark light',
  creator: 'Screenflow',
  publisher: 'Screenflow',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="//cdn.jsdelivr.net" />
        
        {/* Preload critical fonts */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <noscript>
          <link
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
            rel="stylesheet"
          />
        </noscript>
        
        {/* Fallback font styles with font-display */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @font-face {
              font-family: 'Pretendard-fallback';
              src: local('Apple SD Gothic Neo'), local('Noto Sans KR'), local('Malgun Gothic');
              font-display: swap;
              font-weight: 100 900;
            }
            
            /* Critical CSS for font loading */
            body {
              font-family: 'Pretendard-fallback', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
              font-display: swap;
            }
            
            /* Prevent layout shift during font load */
            .font-loaded body {
              font-family: 'Pretendard', 'Pretendard-fallback', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            }
          `
        }} />
        
        {/* WebView optimization meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
        
        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[#0b0b16] text-white overflow-x-hidden`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        
        {/* Font loading optimization script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function addFontLoadedClass() {
                  document.documentElement.classList.add('font-loaded');
                }
                
                if (document.fonts && document.fonts.ready) {
                  document.fonts.ready.then(addFontLoadedClass);
                } else {
                  // Fallback for older browsers
                  setTimeout(addFontLoadedClass, 100);
                }
              })();
            `
          }}
        />
      </body>
    </html>
  );
}
