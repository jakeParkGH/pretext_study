import React, { useState, useMemo } from 'react'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

interface MasonryCardData {
  id: number
  title: string
  text: string
  tag: string
  color: string
}

const RAW_POSTS: MasonryCardData[] = [
  {
    id: 1,
    title: 'Zero CLS의 비결',
    text: '요소가 화면에 그려지기 전 데이터 배열 단계에서 모든 카드의 높이를 마이크로초 단위로 사전 계산하면 레이아웃 시프트가 완전히 사라집니다.',
    tag: '성능 최적화',
    color: '#388bfd',
  },
  {
    id: 2,
    title: '강제 동기 레이아웃(Layout Thrashing)',
    text: 'DOM 요소를 추가한 직후 offsetHeight를 호출하면 Blink 엔진은 VSync를 기다리지 못하고 Document::UpdateStyleAndLayout()을 즉시 실행합니다. 카드가 100개면 단일 프레임 안에서 100번의 강제 레이아웃이 연쇄 호출됩니다.',
    tag: '브라우저 원리',
    color: '#f85149',
  },
  {
    id: 3,
    title: 'Pretext 아키텍처',
    text: '브라우저에게 텍스트 크기를 묻는 대신, 브라우저의 줄바꿈 산술 공식을 우리가 직접 JavaScript/TypeScript로 계산합니다.',
    tag: '아키텍처',
    color: '#bc8cff',
  },
  {
    id: 4,
    title: '수직 동기화(VSync)와 프레임 예산',
    text: '60Hz 모니터는 16.6ms, 120Hz 고주사율 디스플레이는 8.3ms 안에 모든 JS와 렌더링이 완료되어야 프레임 드랍이 발생하지 않습니다.',
    tag: '하드웨어',
    color: '#3fb950',
  },
  {
    id: 5,
    title: '단순한 텍스트 이상의 가치',
    text: '채팅 말풍선 최적화, 자유 형태 텍스트 흐름, 선제적 가상 스크롤 등 브라우저 네이티브 CSS로는 불가능했던 수많은 인터페이스 패턴을 해금합니다.',
    tag: 'UX 혁신',
    color: '#f0883e',
  },
  {
    id: 6,
    title: 'Cold Path vs Hot Path',
    text: '무거운 폰트 측정과 분절은 1회만 수행하고(Cold), 너비 변화에 따른 줄바꿈은 순수 산술 연산만 남깁니다(Hot).',
    tag: '설계 패턴',
    color: '#58a6ff',
  },
]

const FONT = '14px "Pretendard", -apple-system, sans-serif'
const LINE_HEIGHT = 22
const CARD_PADDING = 16
const GAP = 16

export const MasonryDemo: React.FC = () => {
  const [columns, setColumns] = useState<number>(3)
  const [viewportWidth, setViewportWidth] = useState<number>(850)
  const [simulatedReflowCardId, setSimulatedReflowCardId] = useState<number | null>(null)
  const [isSimulatingDom, setIsSimulatingDom] = useState<boolean>(false)
  const [mathFlashKey, setMathFlashKey] = useState<number>(0)

  // [Cold Path]: 텍스트 변경 시 1회만 prepare()
  const preparedCards = useMemo(() => {
    return RAW_POSTS.map((post) => ({
      ...post,
      prepared: prepare(post.text, FONT),
    }))
  }, [])

  // ============================================================================
  // [Pretext 선제적 메이슨리 연산 (pages/demos/masonry/index.ts 인용)]
  // ============================================================================
  // DOM 측정 없이 순수 산술 연산으로 각 카드의 (x, y, height)를 사전 확정
  const masonryLayout = useMemo(() => {
    setMathFlashKey((prev) => prev + 1)
    const start = performance.now()

    const colWidth = (viewportWidth - (columns - 1) * GAP) / columns
    const textWidth = Math.max(50, colWidth - CARD_PADDING * 2)

    // 각 열의 현재 누적 높이 관리 배열
    const colHeights = new Float64Array(columns)

    const positioned = preparedCards.map((card) => {
      // 1. 현재 가장 높이가 낮은 열(shortest column) 찾기
      let shortest = 0
      for (let c = 1; c < columns; c++) {
        if (colHeights[c] < colHeights[shortest]) shortest = c
      }

      // 2. Pretext layout()으로 본문 텍스트 높이 즉각 도출 (0.0002ms)
      const { height: textHeight } = layout(card.prepared, textWidth, LINE_HEIGHT)

      // 3. 카드 전체 높이 (헤더 + 텍스트 + 패딩)
      const headerEstimate = 44
      const cardHeight = headerEstimate + textHeight + CARD_PADDING * 2

      // 4. 절대 좌표(x, y) 할당
      const x = shortest * (colWidth + GAP)
      const y = colHeights[shortest]

      // 5. 해당 열의 누적 높이 업데이트
      colHeights[shortest] += cardHeight + GAP

      return {
        ...card,
        x,
        y,
        width: colWidth,
        height: cardHeight,
      }
    })

    // 전체 컨테이너 높이 도출
    let totalHeight = 0
    for (let c = 0; c < columns; c++) {
      if (colHeights[c] > totalHeight) totalHeight = colHeights[c]
    }

    const elapsedUs = ((performance.now() - start) * 1000).toFixed(2)

    return { positioned, totalHeight, colWidth, elapsedUs }
  }, [preparedCards, columns, viewportWidth])

  // 기존 DOM 역측정 방식의 연쇄 리플로우(Layout Thrashing) 시각적 시뮬레이션
  const handleSimulateDomReflow = () => {
    if (isSimulatingDom) return
    setIsSimulatingDom(true)
    let idx = 0
    const interval = setInterval(() => {
      if (idx < RAW_POSTS.length) {
        setSimulatedReflowCardId(RAW_POSTS[idx]!.id)
        idx++
      } else {
        clearInterval(interval)
        setSimulatedReflowCardId(null)
        setIsSimulatingDom(false)
      }
    }, 250)
  }

  const masonryCodeSample = `// ------------------------------------------------------------------
// [선제적 메이슨리 레이아웃: pages/demos/masonry/index.ts]
// ------------------------------------------------------------------
import { layout } from '@chenglou/pretext'

function computeMasonryLayout(cards, colCount, colWidth) {
  const textWidth = colWidth - CARD_PADDING * 2;
  const colHeights = new Float64Array(colCount); // 각 열 누적 높이

  const positionedCards = cards.map((card) => {
    // 1. 가장 높이가 낮은 열 선택
    let shortest = 0;
    for (let c = 1; c < colCount; c++) {
      if (colHeights[c] < colHeights[shortest]) shortest = c;
    }

    // 2. ⚡ Pretext layout()으로 카드 텍스트 높이 사전 계산 (DOM 미생성 상태!)
    const { height } = layout(card.prepared, textWidth, LINE_HEIGHT);
    const totalCardHeight = height + CARD_PADDING * 2 + HEADER_HEIGHT;

    // 3. 절대 좌표(x, y) 즉시 확정
    const x = shortest * (colWidth + GAP);
    const y = colHeights[shortest];

    colHeights[shortest] += totalCardHeight + GAP;
    return { ...card, x, y, height: totalCardHeight };
  });

  return positionedCards; // DOM 렌더링 전에 이미 모든 좌표가 100% 결정됨!
}
`;

  const masonryLibraryCodeSample = `// ------------------------------------------------------------------
// [@chenglou/pretext 내부 핵심 코드: PreparedCore 병렬 배열 구조]
// 파일: pretext/src/layout.ts (Line 60-85)
// ------------------------------------------------------------------

// ⚡ 최적화 1: 객체 지향 트리 대신 원시 숫자/배열 기반의 병렬 배열(Parallel Arrays) 구조
type PreparedCore = {
  widths: number[]                   // 세그먼트별 사전 측정된 너비 (예: [42.5, 4.4, 37.2])
  kinds: SegmentBreakKind[]          // 세그먼트 줄바꿈 동작 ('text', 'space', 'tab', 'soft-hyphen' 등)
  simpleLineWalkFastPath: boolean    // Bidi나 복합 자간이 없는 일반 텍스트용 초고속 경로 플래그
  chunks: PreparedLineChunk[]        // 강제 개행(\\n) 단위로 사전 분할된 청크 목록
  breakableFitAdvances: (number[] | null)[] // maxWidth 초과 시 글리프 단위 분절용 너비
}

// ⚡ 최적화 2: Opaque Handle 심볼 브랜딩
declare const preparedTextBrand: unique symbol
export type PreparedText = {
  readonly [preparedTextBrand]: true
}

// 💡 왜 대량의 카드 렌더링에 이 구조가 결정적인가?
// - 수십~수백 개의 카드 피드를 계산할 때 DOM 노드를 생성하지 않고
//   평탄한 숫자 배열(Float64Array / number[])만 순회하므로
//   V8 엔진의 JIT 인라인 캐시 및 CPU L1/L2 캐시 히트율이 극대화됩니다.
// - 결과적으로 50~100개 카드의 전체 레이아웃 계산이 1ms 안에 완료됩니다!
`;

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>🧱 선제적 메이슨리 레이아웃 (Predictive Masonry)</span>
          </div>
          <div className="demo-card-desc">
            카드가 DOM에 마운트되기 전, 데이터 배열 상태에서 모든 카드의 절대 위치(x, y)를 확정하여 화면 깜빡임(FOUC)과 레이아웃 시프트(CLS)를 없앱니다.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <span className="control-label">컬럼 수:</span>
            <button
              className={`btn ${columns === 2 ? 'btn-primary' : ''}`}
              onClick={() => setColumns(2)}
            >
              2열
            </button>
            <button
              className={`btn ${columns === 3 ? 'btn-primary' : ''}`}
              onClick={() => setColumns(3)}
            >
              3열
            </button>
            <button
              className={`btn ${columns === 4 ? 'btn-primary' : ''}`}
              onClick={() => setColumns(4)}
            >
              4열
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">뷰포트 폭: {viewportWidth}px</span>
            <input
              type="range"
              min={500}
              max={1000}
              value={viewportWidth}
              onChange={(e) => setViewportWidth(Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className={`btn ${isSimulatingDom ? 'btn-primary' : ''}`}
              onClick={handleSimulateDomReflow}
              disabled={isSimulatingDom}
            >
              {isSimulatingDom ? '🔥 강제 동기 레이아웃 연쇄 발생 중...' : '💥 DOM 역측정 시뮬레이션'}
            </button>

            <span className="metric-pill info">
              ⚡ Pretext 연산: {masonryLayout.elapsedUs} µs
            </span>
          </div>
        </div>

        {/* 메이슨리 캔버스 */}
        <div
          className="masonry-canvas"
          style={{
            height: `${masonryLayout.totalHeight}px`,
            width: `${viewportWidth}px`,
            maxWidth: '100%',
            margin: '0 auto',
          }}
        >
          {masonryLayout.positioned.map((card) => {
            const isReflowingThisCard = simulatedReflowCardId === card.id

            return (
              <div
                key={`${card.id}-${mathFlashKey}-${simulatedReflowCardId}`}
                className={`masonry-item ${isReflowingThisCard ? 'flash-reflow' : 'flash-math'}`}
                style={{
                  transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
                  width: `${card.width}px`,
                  height: `${card.height}px`,
                  border: isReflowingThisCard ? '2px solid #f85149' : undefined,
                  boxShadow: isReflowingThisCard ? '0 0 24px rgba(248, 81, 73, 0.7)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isReflowingThisCard ? '#f85149' : card.color,
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {isReflowingThisCard ? '🔥 FORCED REFLOW!' : card.tag}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8b949e' }}>#{card.id}</span>
                </div>
                <strong style={{ fontSize: '15px', color: '#f0f6fc' }}>{card.title}</strong>
                <p style={{ fontSize: '14px', lineHeight: `${LINE_HEIGHT}px`, color: '#8b949e' }}>
                  {card.text}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 소스 코드 뷰어 (탭 지원) */}
      <CodeViewer
        title="선제적 메이슨리 좌표 도출 및 라이브러리 내부 소스코드"
        snippets={[
          {
            tabLabel: '📱 컴포넌트 메이슨리 코드',
            filePath: 'src/demos/MasonryDemo.tsx',
            code: masonryCodeSample,
            explanation: 'DOM 마운트 전에 데이터 배열 단계에서 모든 카드의 높이를 layout()으로 사전 계산하여 완벽한 (x, y) 좌표를 즉시 결정합니다.',
          },
          {
            tabLabel: '🔬 라이브러리 내부 핵심 코드 (@chenglou/pretext)',
            filePath: 'pretext/src/layout.ts (PreparedCore)',
            code: masonryLibraryCodeSample,
            explanation: 'PreparedCore는 객체 대신 평탄한 숫자 병렬 배열(widths: number[])을 사용하여 V8 엔진 캐시 히트율을 극대화하고 메모리 오버헤드를 0으로 줄입니다.',
          },
        ]}
      />
    </div>
  )
}
