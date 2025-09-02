# 🚨 KOE205 오류 해결 가이드

## 현재 상황
- 코드에서 `profile_image` 스코프 완전 제거됨
- 여전히 KOE205 오류 발생: "설정하지 않은 동의 항목: profile_image"

## 🔍 확인해야 할 설정들

### 1. 카카오 개발자 콘솔 확인 ⚠️
**URL**: https://developers.kakao.com

**확인 단계**:
1. 내 애플리케이션 → 해당 앱 선택
2. **카카오 로그인** → **동의항목** 클릭
3. **프로필 사진** 항목 확인:
   - ✅ **"사용 안함"**으로 설정되어 있어야 함
   - ❌ **"사용함"**으로 되어 있으면 KOE205 발생

### 2. Supabase OAuth 설정 확인 🔧
**URL**: https://supabase.com/dashboard/project/cpaqhythcmolwbdlygen

**확인 단계**:
1. **Authentication** → **Providers** → **Kakao**
2. **Additional Scopes** 필드 확인:
   - ✅ 비어있거나 `profile_nickname account_email`만 있어야 함
   - ❌ `profile_image`가 포함되어 있으면 제거

### 3. 브라우저 캐시 클리어 🧹
1. **개발자 도구** 열기 (F12)
2. **Application** 탭 → **Storage** → **Clear storage**
3. 또는 **시크릿/프라이빗 브라우징** 모드에서 테스트

## 🛠️ 해결 방법

### 방법 1: 카카오 콘솔 설정 변경
```
1. 카카오 개발자 콘솔 접속
2. 동의항목에서 "프로필 사진"을 "사용 안함"으로 변경
3. 저장 후 5-10분 대기 (카카오 서버 반영 시간)
```

### 방법 2: Supabase 설정 확인
```
1. Supabase 대시보드 → Authentication → Providers → Kakao
2. Additional Scopes에서 profile_image 제거
3. 저장 후 재배포
```

### 방법 3: 완전 초기화
```
1. 브라우저 캐시 완전 삭제
2. 카카오 로그아웃 후 재로그인
3. 시크릿 모드에서 테스트
```

## 📋 현재 코드 설정 (정상)
```javascript
// 모든 OAuth 요청에서 사용하는 스코프
scopes: 'profile_nickname account_email'

// 제거된 스코프들
// ❌ profile_image (KOE205 방지)
// ❌ openid (불필요)
```

## 🔗 확인 URL
- **설정 확인**: https://screenflow.pro/api/check-kakao-config
- **로그인 테스트**: https://screenflow.pro/login

## ⏰ 반영 시간
- **카카오 콘솔 변경**: 5-10분
- **Supabase 설정 변경**: 즉시
- **Vercel 배포**: 2-3분
