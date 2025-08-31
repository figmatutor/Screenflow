# Screenflow - 웹 스크린샷 캡처 서비스

AI 기반 웹 페이지 스크린샷 캡처 및 아카이빙 서비스입니다.

## 🚀 주요 기능

- **자동 캡처**: URL 입력만으로 웹 페이지 자동 스크린샷
- **플로우 캡처**: 웹 페이지 링크를 따라가며 연속 캡처
- **인터랙티브 캡처**: 클릭 가능한 요소 자동 감지 및 캡처
- **스마트 캡처**: 페이지 요소 분석 후 선택적 캡처
- **사용자 인증**: Supabase 기반 로그인/회원가입
- **아카이브**: 캡처된 이미지 체계적 관리
- **서비스 추천**: 캡처한 사이트 관련 서비스 추천

## 🛠️ 기술 스택

### Frontend
- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 유틸리티 CSS 프레임워크
- **Shadcn/ui** - UI 컴포넌트 라이브러리
- **Framer Motion** - 애니메이션

### Backend & Infrastructure  
- **Puppeteer** - 브라우저 자동화
- **@sparticuz/chromium** - Serverless 환경용 Chromium
- **Supabase** - 인증 및 데이터베이스
- **Vercel** - 배포 플랫폼

### Database
- **PostgreSQL** (Supabase)
- **Row Level Security (RLS)** - 데이터 보안

## 📋 환경 설정

### 1. 필수 환경변수

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경변수를 설정하세요:

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Chrome 실행 파일 경로 (로컬 개발용 - 선택사항)
CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 설정에서 API Keys 확인
3. `supabase/migrations/20250101000006_ultimate_fix.sql` 파일을 SQL Editor에서 실행

## 🚀 개발 환경 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📦 배포

### Vercel 자동 배포

1. GitHub 저장소를 Vercel에 연결
2. 환경변수 설정 (Vercel 대시보드에서)
3. 자동 배포 완료

### 수동 배포

```bash
# Vercel 로그인
npx vercel login

# 프로덕션 배포
npx vercel --prod
```

## 🔐 인증 시스템

### 회원가입
- 이메일/비밀번호 기반
- 생년월일, 주소 정보 추가 수집
- Supabase Auth 사용

### 로그인 플로우
1. 메인 페이지에서 "로그인" 클릭
2. 이메일/비밀번호 입력
3. 성공 시 메인 페이지로 리다이렉트
4. GNB에 사용자 정보 표시

## 📊 데이터베이스 스키마

### 주요 테이블
- `users`: 사용자 정보
- `capture_sessions`: 캡처 세션
- `screenshots`: 스크린샷 데이터
- `archives`: 아카이브
- `archive_items`: 아카이브 아이템
- `recommended_services`: 추천 서비스

### 보안
- Row Level Security (RLS) 정책 적용
- UUID 기반 사용자 ID
- 세밀한 CRUD 권한 제어

## 🎯 API 엔드포인트

### 캡처 관련
- `POST /api/auto-capture` - 자동 캡처
- `POST /api/capture-flow` - 플로우 캡처  
- `POST /api/interactive-capture` - 인터랙티브 캡처
- `POST /api/smart-capture` - 스마트 캡처

### 사용자 관련
- `GET /api/users/profile` - 사용자 프로필
- `PUT /api/users/profile` - 프로필 업데이트

## 🐛 문제 해결

### 브라우저 초기화 실패
- Chrome/Chromium 설치 확인
- `CHROME_EXECUTABLE_PATH` 환경변수 설정
- Vercel 환경에서는 `@sparticuz/chromium` 자동 사용

### Supabase 연결 오류
- 환경변수 정확성 확인
- 프로젝트 URL 및 API Keys 재확인
- 네트워크 연결 상태 점검

### 로그인 기능 오류
- RLS 정책 적용 확인
- `users` 테이블 존재 여부 확인
- 마이그레이션 파일 실행 확인

## 📚 참고 자료

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Puppeteer Documentation](https://pptr.dev/)
- [Vercel Deployment](https://vercel.com/docs)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 확인하세요.

## 🔗 배포된 서비스

- **Production**: https://screenflow-eight.vercel.app
- **Repository**: https://github.com/figmatutor/Screenflow