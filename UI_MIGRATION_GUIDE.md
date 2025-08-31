# 🎨 UI 구조 마이그레이션 가이드

## 📋 현재 UI 자산 분석

### ✅ 가져갈 핵심 UI 컴포넌트들
```
src/components/ui/
├── 기본 UI 컴포넌트 (shadcn/ui 기반)
│   ├── button.tsx           ✅ 필수
│   ├── card.tsx            ✅ 필수
│   ├── input.tsx           ✅ 필수
│   ├── label.tsx           ✅ 필수
│   ├── checkbox.tsx        ✅ 필수
│   ├── select.tsx          ✅ 필수
│   ├── textarea.tsx        ✅ 필수
│   ├── progress.tsx        ✅ 필수
│   ├── toast.tsx           ✅ 필수
│   ├── toaster.tsx         ✅ 필수
│   └── separator.tsx       ✅ 필수
│
├── 고급 UI 컴포넌트
│   ├── dropdown-menu.tsx   ✅ 추천
│   ├── sheet.tsx          ✅ 추천
│   ├── scroll-area.tsx    ✅ 추천
│   ├── accordion.tsx      ✅ 추천
│   └── form.tsx           ✅ 추천
│
├── 특수 컴포넌트 (선택적)
│   ├── avatar.tsx         🟡 필요시
│   ├── badge.tsx          🟡 필요시
│   └── field.tsx          🟡 필요시
│
└── 프로젝트 특화 컴포넌트 (재설계 필요)
    ├── beams-background.tsx      ❌ 재설계
    ├── animated-ai-chat.tsx      ❌ 재설계
    ├── auto-capture-wizard.tsx   ❌ 재설계
    ├── link-capture-wizard.tsx   ❌ 재설계
    ├── screencapture-studio.tsx  ❌ 재설계
    ├── url-input-with-loading.tsx ❌ 재설계
    └── file-upload.tsx           🟡 참고용
```

### 📁 설정 파일들
```
프로젝트 루트/
├── components.json      ✅ shadcn/ui 설정
├── tailwind.config.ts   ✅ Tailwind 설정
├── tsconfig.json        ✅ TypeScript 설정
└── package.json         🔄 의존성만 참고
```

## 🚀 새 프로젝트 생성 및 UI 이전 스크립트

### 1단계: 새 프로젝트 생성
```bash
# 새 프로젝트 생성
cd ../
npx create-next-app@latest design-reference-system \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd design-reference-system
```

### 2단계: shadcn/ui 초기 설정
```bash
# shadcn/ui 초기화
npx shadcn-ui@latest init

# 필요한 컴포넌트들 추가
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add form
```

### 3단계: 기존 설정 파일 복사
```bash
# Tailwind 설정 복사 (커스텀 설정 유지)
cp ../Screenflow\ 4/tailwind.config.ts ./

# Components.json 설정 복사
cp ../Screenflow\ 4/components.json ./

# TypeScript 설정 참고 (필요한 부분만)
cp ../Screenflow\ 4/tsconfig.json ./tsconfig.reference.json
```

### 4단계: 유용한 유틸리티 및 훅 복사
```bash
# 유틸리티 함수들
mkdir -p src/lib
cp ../Screenflow\ 4/src/lib/utils.ts src/lib/

# 커스텀 훅들
mkdir -p src/hooks
cp ../Screenflow\ 4/src/hooks/use-toast.ts src/hooks/
cp ../Screenflow\ 4/src/hooks/use-auto-resize-textarea.ts src/hooks/
```

### 5단계: 글로벌 스타일 설정
```bash
# 글로벌 CSS 복사 (기본 스타일만)
cp ../Screenflow\ 4/src/app/globals.css src/app/
```

## 🎨 새 프로젝트용 UI 구조 설계

### 새로운 컴포넌트 구조
```
src/components/
├── ui/                    # shadcn/ui 기본 컴포넌트들
├── layout/               # 레이아웃 컴포넌트
│   ├── header.tsx
│   ├── navigation.tsx
│   └── footer.tsx
├── input/                # 입력 관련 컴포넌트
│   ├── url-input.tsx
│   ├── image-upload.tsx
│   └── preferences-form.tsx
├── gallery/              # 갤러리 관련 컴포넌트
│   ├── reference-card.tsx
│   ├── reference-grid.tsx
│   └── filter-panel.tsx
├── analysis/             # AI 분석 관련 컴포넌트
│   ├── vision-result.tsx
│   ├── similarity-score.tsx
│   └── analysis-progress.tsx
├── selection/            # 선택 관련 컴포넌트
│   ├── selection-panel.tsx
│   ├── capture-options.tsx
│   └── export-settings.tsx
└── export/               # 내보내기 관련 컴포넌트
    ├── download-progress.tsx
    ├── export-preview.tsx
    └── figma-integration.tsx
```

## 📦 필요한 의존성 추가
```bash
# AI/ML 관련
npm install openai @pinecone-database/pinecone

# 이미지 처리
npm install sharp jimp

# 웹 크롤링
npm install playwright @playwright/test

# 파일 처리
npm install jszip archiver

# 상태 관리
npm install @tanstack/react-query zustand

# 유틸리티
npm install date-fns ts-pattern es-toolkit

# UUID (기존 프로젝트에서 사용 중)
npm install uuid @types/uuid

# 애니메이션
npm install framer-motion

# 아이콘
npm install lucide-react
```

## 🔄 이전 과정 자동화 스크립트

### UI 컴포넌트 이전 스크립트
```bash
#!/bin/bash
# ui-migration.sh

OLD_PROJECT="../Screenflow 4"
NEW_PROJECT="./design-reference-system"

echo "🚀 UI 구조 이전 시작..."

# 기본 UI 컴포넌트들 복사
echo "📁 기본 UI 컴포넌트 복사 중..."
cp "$OLD_PROJECT/src/components/ui/button.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/card.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/input.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/label.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/checkbox.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/select.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/textarea.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/progress.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/toast.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/toaster.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/separator.tsx" "$NEW_PROJECT/src/components/ui/"

# 고급 컴포넌트들 복사
echo "🔧 고급 UI 컴포넌트 복사 중..."
cp "$OLD_PROJECT/src/components/ui/dropdown-menu.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/sheet.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/scroll-area.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/accordion.tsx" "$NEW_PROJECT/src/components/ui/"
cp "$OLD_PROJECT/src/components/ui/form.tsx" "$NEW_PROJECT/src/components/ui/"

# 설정 파일들 복사
echo "⚙️ 설정 파일 복사 중..."
cp "$OLD_PROJECT/tailwind.config.ts" "$NEW_PROJECT/"
cp "$OLD_PROJECT/components.json" "$NEW_PROJECT/"

# 유틸리티 및 훅 복사
echo "🛠️ 유틸리티 복사 중..."
mkdir -p "$NEW_PROJECT/src/lib"
mkdir -p "$NEW_PROJECT/src/hooks"
cp "$OLD_PROJECT/src/lib/utils.ts" "$NEW_PROJECT/src/lib/"
cp "$OLD_PROJECT/src/hooks/use-toast.ts" "$NEW_PROJECT/src/hooks/"

echo "✅ UI 구조 이전 완료!"
echo "📝 다음 단계: npm install 후 개발 시작"
```

## 🎯 이전 후 체크리스트

### ✅ 확인 사항
- [ ] shadcn/ui 컴포넌트들이 정상 작동하는지
- [ ] Tailwind CSS 설정이 올바르게 적용되는지
- [ ] TypeScript 타입 에러가 없는지
- [ ] 커스텀 훅들이 정상 작동하는지
- [ ] 글로벌 스타일이 올바르게 로드되는지

### 🎨 새 프로젝트 전용 개선사항
- [ ] 다크모드 지원 추가
- [ ] 반응형 디자인 최적화
- [ ] 접근성(a11y) 개선
- [ ] 애니메이션 효과 추가
- [ ] 컴포넌트 스토리북 구성

## 💡 팁과 권장사항

1. **점진적 이전**: 한 번에 모든 컴포넌트를 이전하지 말고 필요한 것부터 단계적으로
2. **타입 안전성**: 기존 컴포넌트의 타입 정의를 새 프로젝트에 맞게 업데이트
3. **스타일 일관성**: 새 프로젝트의 디자인 시스템에 맞게 스타일 조정
4. **성능 최적화**: 불필요한 의존성 제거 및 번들 사이즈 최적화
5. **문서화**: 새로운 컴포넌트 구조에 대한 문서 작성

이렇게 하면 기존 프로젝트의 UI 자산을 최대한 활용하면서도 새로운 아키텍처에 맞는 깔끔한 프로젝트를 구축할 수 있습니다! 🚀
