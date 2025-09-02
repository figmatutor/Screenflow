# 🔐 카카오 로그인 설정 가이드

## 📋 필수 설정 사항

### 1. 카카오 개발자 콘솔 설정

**접속:** https://developers.kakao.com

#### 📱 애플리케이션 설정
1. **내 애플리케이션** → 해당 앱 선택
2. **앱 키** 확인 (REST API 키 사용)

#### 🔗 Redirect URI 설정
**경로:** 카카오 로그인 → Redirect URI

**추가할 URL들:**
```
http://localhost:3001/auth/callback    (개발용)
https://screenflow.pro/auth/callback   (프로덕션용)
```

#### 🔐 동의항목 설정
**경로:** 카카오 로그인 → 동의항목

**필수 설정 항목:**
- ✅ 닉네임 (profile_nickname) - 사용자 표시명
- ✅ 카카오계정(이메일) (account_email) - 연락처 정보
- ✅ 프로필 사진 (profile_image) - 사용자 아바타

**수집하지 않는 항목:**
- ❌ OpenID Connect (openid) - 불필요
- ❌ 기타 개인정보 - 서비스에 불필요한 정보

**개인정보 수집 원칙:**
- 🎯 서비스 운영에 필요한 기본 정보 수집
- 🔒 사용자 프라이버시 보호 우선
- 📝 투명한 정보 수집 정책

### 2. Supabase 대시보드 설정

**접속:** https://supabase.com/dashboard

#### 🔧 Authentication Provider 설정
**경로:** Authentication → Providers → Kakao

**설정값:**
- ✅ **Enabled:** ON
- 📝 **Client ID:** 카카오 REST API 키
- 🔑 **Client Secret:** 카카오 Client Secret
- 🔗 **Redirect URL:** `https://cpaqhythcmolwbdlygen.supabase.co/auth/v1/callback`

## 🧪 테스트 방법

### 1. 로컬 테스트
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 접속
http://localhost:3001/login
```

### 2. 설정 확인
```bash
# 설정 확인 API
curl http://localhost:3001/api/check-kakao-config
```

### 3. 디버깅
브라우저 콘솔에서 다음 로그 확인:
- `[Kakao Login] OAuth 요청 시작`
- `[Kakao Login] 현재 도메인`
- `[Kakao Login] 리다이렉트 URL`
- `[Auth Callback] 사용자 정보`

## ⚠️ 주의사항

### 도메인 정확성
- 카카오 콘솔의 Redirect URI와 실제 도메인이 **정확히 일치**해야 함
- 포트 번호까지 정확해야 함 (`3000` ≠ `3001`)

### HTTPS 필수
- 프로덕션 환경에서는 반드시 `https://` 사용
- 로컬 개발에서만 `http://` 허용

### 스코프 설정
현재 요청하는 스코프:
```javascript
scopes: 'profile_nickname account_email profile_image'
```

**스코프 설명:**
- `profile_nickname`: 카카오 닉네임 정보 (필수)
- `account_email`: 카카오계정 이메일 주소 (필수)
- `profile_image`: 카카오 프로필 사진 (사용자 아바타)

**제외된 스코프:**
- ❌ `openid`: OpenID Connect 불필요

**수집 정보 활용:**
- 🎯 사용자 식별 및 표시
- 👤 개인화된 사용자 경험
- 📧 서비스 관련 연락

## 🔍 문제 해결

### 자주 발생하는 오류

#### 1. `KOE205` 오류 ⚠️ (중요!)
- **원인**: 카카오 개발자 콘솔의 동의항목 설정과 코드에서 요청하는 스코프가 일치하지 않음
- **해결**: 
  - 카카오 개발자 콘솔에서 프로필 사진을 "사용함"으로 설정
  - 코드에서 `profile_image` 스코프 포함
  - **현재 설정**: `scopes: 'profile_nickname account_email profile_image'`
- **확인 방법**: 
  1. 카카오 로그인 → 동의항목에서 프로필 사진이 "사용함"으로 설정되어 있는지 확인
  2. 코드에서 `profile_image` 스코프가 포함되어 있는지 확인

#### 2. `redirect_uri_mismatch`
- 카카오 콘솔의 Redirect URI 설정 확인
- 도메인과 포트 번호 정확성 확인

#### 3. `invalid_client`
- 카카오 REST API 키 확인
- Supabase의 Client ID 설정 확인

#### 4. `access_denied`
- 카카오 동의항목 설정 확인
- 사용자가 필수 동의항목을 거부했는지 확인

## 📞 지원

문제가 지속되면 다음을 확인:
1. `/api/check-kakao-config` 엔드포인트 결과
2. 브라우저 콘솔 로그
3. Supabase 대시보드 로그
4. 카카오 개발자 콘솔 설정

---

**마지막 업데이트:** 2025-01-02
**버전:** 1.0.0
