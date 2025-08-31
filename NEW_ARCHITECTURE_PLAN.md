# 🎨 Design Reference Capture System
## 새로운 아키텍처 구축 계획

### 📋 프로젝트 개요
사용자가 제공한 이미지 또는 URL을 기반으로 AI가 분석하여 유사한 레퍼런스를 추천하고, 선택된 페이지들을 캡처하여 PNG/ZIP/Figma로 내보내는 통합 시스템

### 🏗️ 아키텍처 구성

#### 1. 사용자 입력 (User Input)
```typescript
interface UserInput {
  type: 'image' | 'url';
  data: string; // base64 image or URL
  preferences?: {
    style: 'minimal' | 'modern' | 'classic';
    industry: 'ecommerce' | 'portfolio' | 'blog';
    components: string[];
  };
}
```

#### 2. Playwright 크롤링 (Playwright Crawling)
```typescript
// 페이지 전역 탐색 + 섹션 추출
interface CrawlResult {
  url: string;
  sections: PageSection[];
  metadata: PageMetadata;
  screenshots: {
    full: Buffer;
    sections: SectionScreenshot[];
  };
}
```

#### 3. Vision/Embedding (AI Analysis)
```typescript
// OpenAI Vision + Vector Database
interface VisionAnalysis {
  layout: LayoutStructure;
  colorPalette: string[];
  components: ComponentType[];
  style: StyleClassification;
  embedding: number[]; // 벡터 임베딩
}
```

#### 4. 레퍼런스 추천 시스템 (Reference Recommendation)
```typescript
// Vector Similarity + AI Filtering
interface RecommendationEngine {
  findSimilar(query: VisionAnalysis): Promise<Reference[]>;
  rankByRelevance(refs: Reference[]): Reference[];
  filterByPreferences(refs: Reference[], prefs: UserPreferences): Reference[];
}
```

#### 5. 사용자 선택 (User Selection)
```typescript
// Interactive Gallery UI
interface SelectionInterface {
  gallery: ReferenceCard[];
  filters: FilterOptions;
  selectedItems: SelectedReference[];
  customizations: CaptureOptions;
}
```

#### 6. 캡처 & 내보내기 (Capture & Export)
```typescript
// Multi-format Export
interface ExportSystem {
  capturePNG(refs: SelectedReference[]): Promise<Buffer[]>;
  createZIP(files: Buffer[]): Promise<Buffer>;
  exportToFigma(refs: SelectedReference[]): Promise<FigmaExportResult>;
}
```

### 🛠️ 기술 스택

#### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion** (애니메이션)
- **React Query** (상태 관리)

#### Backend
- **Playwright** (웹 크롤링)
- **OpenAI Vision API** (이미지 분석)
- **Pinecone/Weaviate** (Vector Database)
- **Sharp** (이미지 처리)

#### AI/ML
- **OpenAI GPT-4 Vision** (이미지 구조 분석)
- **CLIP Embeddings** (시각적 유사도)
- **Custom Vision Model** (UI 컴포넌트 인식)

#### Export
- **JSZip** (ZIP 생성)
- **Figma API** (기존 mcp_TalkToFigma 활용)
- **Canvas API** (고급 이미지 처리)

### 📁 새 프로젝트 구조

```
design-reference-system/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/          # Vision AI 분석
│   │   │   ├── crawl/            # Playwright 크롤링
│   │   │   ├── recommend/        # 레퍼런스 추천
│   │   │   ├── capture/          # 선택된 페이지 캡처
│   │   │   └── export/           # PNG/ZIP/Figma 내보내기
│   │   ├── components/
│   │   │   ├── input/            # 입력 인터페이스
│   │   │   ├── gallery/          # 레퍼런스 갤러리
│   │   │   ├── selection/        # 선택 도구
│   │   │   └── export/           # 내보내기 UI
│   │   └── page.tsx              # 통합 메인 페이지
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── vision.ts         # OpenAI Vision
│   │   │   ├── embeddings.ts     # Vector 처리
│   │   │   └── recommendations.ts # 추천 엔진
│   │   ├── crawler/
│   │   │   ├── playwright.ts     # 크롤링 엔진
│   │   │   └── sections.ts       # 섹션 추출
│   │   ├── export/
│   │   │   ├── png.ts           # PNG 생성
│   │   │   ├── zip.ts           # ZIP 생성
│   │   │   └── figma.ts         # Figma 연동
│   │   └── database/
│   │       ├── vector.ts        # Vector DB
│   │       └── cache.ts         # 캐싱
│   └── types/
│       ├── analysis.ts          # AI 분석 타입
│       ├── capture.ts           # 캡처 타입
│       └── export.ts            # 내보내기 타입
```

### 🎯 핵심 차별점

1. **AI 기반 추천**: 단순 크롤링 → 지능형 레퍼런스 추천
2. **통합 워크플로우**: 개별 도구들 → 하나의 완성된 시스템
3. **디자이너 친화적**: 개발자용 → 디자이너용 UX
4. **다중 내보내기**: PNG만 → PNG/ZIP/Figma 동시 지원

### ⏱️ 개발 타임라인

#### Phase 1 (3-4일): 기본 아키텍처
- [ ] 프로젝트 셋업 및 기본 구조
- [ ] 입력 인터페이스 (URL/이미지)
- [ ] Playwright 기본 크롤링

#### Phase 2 (4-5일): AI 분석 엔진
- [ ] OpenAI Vision API 연동
- [ ] 이미지 구조 분석
- [ ] Vector Database 셋업

#### Phase 3 (3-4일): 추천 시스템
- [ ] 유사도 검색 엔진
- [ ] 레퍼런스 갤러리 UI
- [ ] 필터링 및 정렬

#### Phase 4 (2-3일): 캡처 & 내보내기
- [ ] 선택된 페이지 캡처
- [ ] PNG/ZIP 생성
- [ ] Figma 연동 (기존 도구 활용)

#### Phase 5 (1-2일): 폴리싱
- [ ] UX/UI 개선
- [ ] 성능 최적화
- [ ] 테스트 및 디버깅

**총 예상 기간: 13-18일**

### 💡 현재 프로젝트 활용 방안

1. **Figma 연동 도구**: 그대로 활용 ✅
2. **Puppeteer 경험**: Playwright로 쉽게 전환 ✅
3. **ZIP 생성 로직**: 재사용 가능 ✅
4. **Anti-detection 설정**: 그대로 활용 ✅
5. **UI 컴포넌트들**: shadcn/ui 기반으로 재사용 ✅

### 🚀 시작 방법

새 프로젝트를 시작하되, 현재 프로젝트의 유용한 부분들을 선별적으로 이전하는 방식을 추천합니다.

```bash
# 새 프로젝트 생성
npx create-next-app@latest design-reference-system --typescript --tailwind --app

# 현재 프로젝트에서 재사용할 부분들
cp -r src/components/ui ../design-reference-system/src/components/
cp -r src/lib/utils.ts ../design-reference-system/src/lib/
# Figma 연동 도구들도 선별적으로 이전
```

이렇게 하면 현재 프로젝트의 장점은 보존하면서도 깔끔하고 체계적인 새 아키텍처를 구축할 수 있습니다.
