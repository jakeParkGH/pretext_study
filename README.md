# Pretext 실습 & 아키텍처 학습용 React 샌드박스

이 프로젝트는 [`@chenglou/pretext`](https://github.com/chenglou/pretext)의 핵심 원리와 브라우저 렌더링 파이프라인(Layout - Paint - Composite / VSync) 최적화 기법을 직접 확인하고 학습할 수 있도록 구성된 React + TypeScript 실습 애플리케이션입니다.

---

## 🚀 빠른 시작

```bash
# 의존성 설치
pnpm install

# 로컬 개발 서버 구동 (기본 포트: 5173)
pnpm dev
```

브라우저에서 `http://localhost:5173`으로 접속하면 인터랙티브 샌드박스를 확인하실 수 있습니다.

---

## 📁 프로젝트 구조 및 데모 구성

```
sample/
├── src/
│   ├── demos/
│   │   ├── BasicMeasureDemo.tsx   # 1. Cold Path vs Hot Path 성능 비교 및 벤치마크
│   │   ├── ChatBubbleDemo.tsx     # 2. 동적 채팅 말풍선 여백 최적화 (이진 탐색)
│   │   ├── MasonryDemo.tsx        # 3. 선제적 메이슨리 레이아웃 (Zero CLS)
│   │   ├── ShapeFlowDemo.tsx      # 4. 자유 형태 텍스트 래핑 (커서 기반 장애물 회피)
│   │   ├── StreamingDemo.tsx      # 5. LLM 실시간 토큰 스트리밍 & VSync 보호
│   │   └── TanStackFeedDemo.tsx   # 6. TanStack Virtual 무한스크롤 & Transform 좌표 주입
│   ├── components/
│   │   ├── CodeViewer.tsx         # 코드 및 상세 주석 학습용 뷰어
│   │   └── Header.tsx             # 헤더
│   ├── App.tsx                    # 탭 네비게이션 및 라우팅
│   ├── App.css                    # 다크 모드 스타일링
│   └── main.tsx                   # React 엔트리포인트
├── vite.config.ts                 # 로컬 pretext 패키지(src/) 직접 연결 설정
├── package.json
└── tsconfig.json
```

---

## 💡 포함된 6가지 핵심 데모

1. **Cold Path vs Hot Path 성능 측정 ([`BasicMeasureDemo.tsx`](src/demos/BasicMeasureDemo.tsx))**
   - 1회성 전처리 `prepare()`와 마이크로초(0.0002ms) 순수 산술 연산 `layout()`의 성능 측정
   - 실제 DOM `offsetHeight` 호출로 인한 하드 리플로우 비용과의 직관적 비교

2. **동적 채팅 말풍선 최적화 ([`ChatBubbleDemo.tsx`](src/demos/ChatBubbleDemo.tsx))**
   - `pretext/pages/demos/bubbles-shared.ts`의 이진 탐색(`findTightWrapMetrics`) 인용
   - 총 줄 수를 유지하는 최소 너비를 찾아 우측 낭비 공간(Wasted Space)을 0px로 제거하는 실시간 토글 비교

3. **선제적 메이슨리 레이아웃 ([`MasonryDemo.tsx`](src/demos/MasonryDemo.tsx))**
   - `pretext/pages/demos/masonry/index.ts` 인용
   - DOM 마운트 전에 카드 높이를 사전 계산하여 절대 좌표 `(x, y)`를 즉시 할당, FOUC와 CLS(Cumulative Layout Shift) 제로 달성

4. **자유 형태 텍스트 플로우 ([`ShapeFlowDemo.tsx`](src/demos/ShapeFlowDemo.tsx))**
   - `pretext/pages/demos/dynamic-layout.ts` 인용
   - `layoutNextLine()` 커서 기반 API를 활용하여 원형 장애물의 위치와 반경을 피해 60fps로 매끄럽게 흐르는 텍스트 배치

5. **LLM 실시간 토큰 스트리밍 & VSync 보호 ([`StreamingDemo.tsx`](src/demos/StreamingDemo.tsx))**
   - 토큰 유입 시 `scrollTop = scrollHeight`로 인한 초당 수십 회의 하드 리플로우 문제 시뮬레이션
   - Pretext 순수 연산 기반 높이 예측을 통한 UI 스레드 보호 및 부드러운 스크롤 구현

6. **TanStack Virtual 무한스크롤 & Transform 좌표 주입 ([`TanStackFeedDemo.tsx`](src/demos/TanStackFeedDemo.tsx))**
   - 현업 표준 가상화 라이브러리(`@tanstack/react-virtual`)의 `estimateSize`에 Pretext 사전 계산 배열을 100% 정밀 주입
   - 동적 DOM 역측정(`measureElement`)을 원천 제거하고 `transform: translate3d(0, y, 0)`로 브라우저 GPU 합성(Composite) 단계로 직행하여 120Hz 무감속 무한스크롤 실시간 검증
