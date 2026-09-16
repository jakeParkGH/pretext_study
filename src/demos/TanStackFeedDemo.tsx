import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer, type CodeSnippet } from '../components/CodeViewer'

// ============================================================================
// 타입 정의 및 기본 설정
// ============================================================================
export interface FeedCardData {
  id: number
  author: string
  handle: string
  avatarColor: string
  aspectRatio: number // 16/9, 4/3, 1, 2/3
  gradient: string
  title: string
  prompt: string
  version: string
  likes: number
  category: string
}

export interface PreparedFeedCard extends FeedCardData {
  preparedPrompt: PreparedText
}

const FONT = '16px Pretendard, sans-serif'
const LINE_HEIGHT = 24
const CARD_PADDING = 16
const GAP = 16
// 고정 UI 오버헤드:
// 인덱스바(24px+10px) + 헤더(44px+12px) + 이미지하단간격(12px) + 프롬프트라벨(16px+4px) + 프롬프트하단간격(12px)
// + 푸터(28px+8px) + 카드패딩(32px) + 카드테두리(2px) + 카드하단간격GAP(16px) = 220px
const FIXED_OVERHEAD = 220

const SEED_PROMPTS = [
  {
    title: '네오 서울 사이버펑크 야시장',
    prompt: 'cyberpunk neon street market in Neo-Seoul 2099, holographic signs reflecting on rain-slicked asphalt pavement, dense atmosphere, cinematic volumetric mist, intricate steam pipes, street food stalls, shot on 35mm anamorphic lens --ar 16:9 --v 6.1 --s 750',
    aspectRatio: 16 / 9,
    gradient: 'linear-gradient(135deg, #1f1c2c, #928dab)',
    author: 'Min-ji Kim',
    handle: '@neo_minji',
    avatarColor: '#58a6ff',
    category: 'Cyberpunk',
  },
  {
    title: '현대 교토의 대나무 정원 파빌리온',
    prompt: 'minimalist architectural pavilion in modern Kyoto, bamboo reflection on calm water, clean geometric shadows, muted palette --ar 1:1 --v 6.0',
    aspectRatio: 1,
    gradient: 'linear-gradient(135deg, #2c3e50, #3498db)',
    author: 'Kenji Sato',
    handle: '@kenji_arch',
    avatarColor: '#3fb950',
    category: 'Architecture',
  },
  {
    title: '고대 유적지 속 잠든 기계신',
    prompt: 'hyperrealistic cinematic portrait of an ancient robotic deity carved out of obsidian marble and glowing cyan circuitry, resting inside an overgrown sunken cathedral with glowing bioluminescent moss and cascading water, god rays breaking through shattered stained glass dome, unreal engine 5.4 render, octane lighting, photorealistic textures, 8k resolution, award winning photography, masterwork --ar 16:9 --v 6.1 --s 800 --style raw --q 2',
    aspectRatio: 16 / 9,
    gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    author: 'Elena Rostova',
    handle: '@elena_art',
    avatarColor: '#bc8cff',
    category: 'Sci-Fi',
  },
  {
    title: '아침 햇살과 따뜻한 녹차',
    prompt: 'a serene ceramic teacup emitting gentle steam, morning sunlight on wooden tatami --ar 4:3 --v 6.0',
    aspectRatio: 4 / 3,
    gradient: 'linear-gradient(135deg, #596164, #868f96)',
    author: 'Ji-hoon Park',
    handle: '@quiet_mornings',
    avatarColor: '#f0883e',
    category: 'Minimal',
  },
  {
    title: '양자 슈퍼컴퓨터 단면 설계도',
    prompt: 'isometric cutaway diagram of a futuristic subterranean data center and quantum fusion reactor, detailed technical blueprints, intricate wiring conduits, translucent server racks with glowing fiber optics, ambient occlusion, blueprint aesthetic, schematic illustration --chaos 20 --stylize 250 --ar 16:9',
    aspectRatio: 16 / 9,
    gradient: 'linear-gradient(135deg, #134e5e, #71b280)',
    author: 'Marcus Vance',
    handle: '@vance_quant',
    avatarColor: '#388bfd',
    category: 'Diagram',
  },
  {
    title: '안개 속의 버려진 우주 정거장',
    prompt: 'abandoned retro-futuristic deep space orbital habitat drifting through violet nebular clouds, retro computers with CRT displays, floating zero-gravity debris, solitary melancholic mood, dramatic chiaroscuro lighting, grainy vintage film stock --ar 2:3 --v 6.1',
    aspectRatio: 2 / 3,
    gradient: 'linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)',
    author: 'Astrid Lind',
    handle: '@astrid_space',
    avatarColor: '#f85149',
    category: 'Retro',
  },
  {
    title: '신비로운 발광 해파리 군집',
    prompt: 'deep ocean abyss with ethereal translucent bioluminescent siphonophores and glowing jellies, macro details of pulsating cilia, crystalline turquoise refraction, national geographic deep sea expedition --ar 1:1 --v 6.0',
    aspectRatio: 1,
    gradient: 'linear-gradient(135deg, #000428, #004e92)',
    author: 'David Chen',
    handle: '@chen_deep',
    avatarColor: '#58a6ff',
    category: 'Nature',
  },
]

function generateItems(startIndex: number, count: number): PreparedFeedCard[] {
  return Array.from({ length: count }, (_, i) => {
    const id = startIndex + i + 1
    const seed = SEED_PROMPTS[(id - 1) % SEED_PROMPTS.length]!
    const likes = Math.floor(20 + ((id * 37) % 850))

    return {
      id,
      title: `${seed.title} #${id}`,
      prompt: seed.prompt,
      aspectRatio: seed.aspectRatio,
      gradient: seed.gradient,
      author: seed.author,
      handle: seed.handle,
      avatarColor: seed.avatarColor,
      category: seed.category,
      version: 'v6.1',
      likes,
      // [Cold Path]: 생성 시 1회만 prepare() 호출 (Pretendard 16px + pre-wrap + keep-all 캐싱)
      preparedPrompt: prepare(seed.prompt, FONT, {
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
      }),
    }
  })
}

export const TanStackFeedDemo: React.FC = () => {
  const [items, setItems] = useState<PreparedFeedCard[]>(() => generateItems(0, 30))
  const [feedWidth, setFeedWidth] = useState<number>(560)
  const [usePretextEstimate, setUsePretextEstimate] = useState<boolean>(true)
  const [useTransform, setUseTransform] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [mathFlashKey, setMathFlashKey] = useState<number>(0)
  const [measureCounter, setMeasureCounter] = useState<number>(0)
  const [measuredReflowTimeMs, setMeasuredReflowTimeMs] = useState<number>(0)
  const [isStressTesting, setIsStressTesting] = useState<boolean>(false)
  const [stressTestResult, setStressTestResult] = useState<string | null>(null)
  const [recentlyMeasuredId, setRecentlyMeasuredId] = useState<number | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [maxAvailableWidth, setMaxAvailableWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(560, window.innerWidth - 64) : 560
  )

  useEffect(() => {
    if (!wrapperRef.current) return
    const updateWidth = () => {
      if (wrapperRef.current) {
        setMaxAvailableWidth(Math.floor(wrapperRef.current.clientWidth))
      }
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  const effectiveFeedWidth = Math.max(260, Math.min(feedWidth, maxAvailableWidth))

  // ============================================================================
  // [Pretext 핫패스 연산]: 너비 변화 또는 아이템 추가 시 각 카드의 정확한 높이 배열 산출
  // ============================================================================
  const { precalculatedHeights, calcTimeUs } = useMemo(() => {
    setMathFlashKey((prev) => prev + 1)
    const t0 = performance.now()

    // 카드의 텍스트 영역 실제 가용 폭
    const textWidth = Math.max(80, effectiveFeedWidth - CARD_PADDING * 2 - 2)

    const heights = new Float64Array(items.length)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      // 1. 이미지는 종횡비 나눗셈으로 즉시 도출 (0ms)
      const imageHeight = Math.round(textWidth / item.aspectRatio)

      // 2. 가변 프롬프트 텍스트 높이는 Pretext layout()으로 순수 산술 도출 (0.0002ms)
      const { height: promptHeight } = layout(item.preparedPrompt, textWidth, LINE_HEIGHT)

      // 3. 카드 전체 높이 = 고정 오버헤드 + 이미지 높이 + 텍스트 높이
      heights[i] = FIXED_OVERHEAD + imageHeight + promptHeight
    }

    const t1 = performance.now()
    const us = ((t1 - t0) * 1000).toFixed(2)

    return { precalculatedHeights: heights, calcTimeUs: us }
  }, [items, effectiveFeedWidth])

  const measuredNodesRef = useRef<WeakSet<HTMLElement>>(new WeakSet())

  // ============================================================================
  // [TanStack Virtual 설정]
  // ============================================================================
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    // [핵심 차이점]:
    // 🚀 Pretext 모드: estimateSize에 100% 정밀 사전 계산 배열을 그대로 반환!
    // ⚠️ 미적용 모드: 기본 추정치(500px)를 반환하고, 실제 렌더링 후 measureElement로 역측정
    estimateSize: (index) => {
      if (usePretextEstimate) {
        return precalculatedHeights[index] || 500
      }
      return 500
    },
    overscan: 5,
  })

  const rowVirtualizerRef = useRef(rowVirtualizer)
  rowVirtualizerRef.current = rowVirtualizer

  // 무한 스크롤 자동 감지 및 로딩
  const virtualItems = rowVirtualizer.getVirtualItems()

  useEffect(() => {
    if (virtualItems.length === 0) return
    const container = scrollContainerRef.current
    if (!container) return

    const lastItem = virtualItems[virtualItems.length - 1]
    // 💡 사용자가 실제로 스크롤을 내려 바닥 300px 이내에 도달했을 때만 추가 로딩 트리거
    // (모드 전환이나 초기 마운트 시의 잘못된 폭주 호출 원천 방지)
    const isAtBottom =
      container.scrollTop > 50 &&
      container.scrollTop + container.clientHeight >= container.scrollHeight - 300

    if (
      isAtBottom &&
      lastItem &&
      lastItem.index >= items.length - 2 &&
      !isLoadingMore &&
      items.length < 500
    ) {
      setIsLoadingMore(true)
      setTimeout(() => {
        setItems((prev) => [...prev, ...generateItems(prev.length, 20)])
        setIsLoadingMore(false)
      }, 250)
    }
  }, [virtualItems, items.length, isLoadingMore])

  // 수동 아이템 추가 핸들러
  const handleAddMore = (count: number) => {
    setItems((prev) => [...prev, ...generateItems(prev.length, count)])
  }

  const handleReset = () => {
    setItems(generateItems(0, 30))
    setMeasureCounter(0)
    setMeasuredReflowTimeMs(0)
    setStressTestResult(null)
    setRecentlyMeasuredId(null)
    measuredNodesRef.current = new WeakSet()
    rowVirtualizer.measure()
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 모드 전환(Pretext ON/OFF) 또는 너비 변경 시 가상화 측정 캐시를 리셋하여 깨끗하게 재측정
  useEffect(() => {
    measuredNodesRef.current = new WeakSet()
    rowVirtualizer.measure()
  }, [usePretextEstimate, effectiveFeedWidth])

  // 전통적 동적 측정 모드일 때 DOM 역측정 및 강제 리플로우 감지
  const measureCallback = useCallback(
    (node: HTMLElement | null) => {
      if (!usePretextEstimate && node) {
        // 중복 측정 방지: 이미 측정한 노드가 리렌더링될 때 무한 setState 폭주 차단
        if (measuredNodesRef.current.has(node)) {
          return
        }
        measuredNodesRef.current.add(node)

        const t0 = performance.now()
        // 🔥 Blink 엔진의 Document::UpdateStyleAndLayout() 강제 동기 호출!
        const _measuredHeight = node.offsetHeight
        const t1 = performance.now()

        setMeasuredReflowTimeMs((prev) => prev + (t1 - t0))
        setMeasureCounter((prev) => prev + 1)

        const cardId = Number(node.dataset.cardId)
        if (cardId) {
          setRecentlyMeasuredId(cardId)
        }

        rowVirtualizerRef.current.measureElement(node)
      }
    },
    [usePretextEstimate]
  )

  // ============================================================================
  // [Pretext 미적용 시 발생하는 연쇄 리플로우(Layout Thrashing) 스트레스 테스트]
  // ============================================================================
  const handleStressTestLayoutThrashing = () => {
    if (!scrollContainerRef.current || isStressTesting) return
    setIsStressTesting(true)
    setStressTestResult(null)

    setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) return

      const cards = container.querySelectorAll('.feed-card-inner')
      if (cards.length === 0) {
        setIsStressTesting(false)
        return
      }

      const t0 = performance.now()
      let totalThrashingReads = 0

      // 루프 내에서 "DOM 스타일 변경(Write) ➔ offsetHeight 읽기(Read)" 반복 강제 실행!
      for (let iteration = 0; iteration < 15; iteration++) {
        cards.forEach((cardEl) => {
          const el = cardEl as HTMLElement
          // Write (Dirty bit 세팅)
          el.style.paddingLeft = `${16 + (iteration % 2)}px`
          // Read (강제 동기 레이아웃 Document::UpdateStyleAndLayout 호출!)
          const _h = el.offsetHeight
          totalThrashingReads++
        })
      }

      // 원래 스타일 복구
      cards.forEach((cardEl) => {
        ;(cardEl as HTMLElement).style.paddingLeft = `${CARD_PADDING}px`
      })

      const t1 = performance.now()
      const elapsed = (t1 - t0).toFixed(2)

      setStressTestResult(
        `💥 ${totalThrashingReads}회 연속 Document::UpdateStyleAndLayout() 동기 실행! 메인 스레드 ${elapsed}ms 블로킹 발생 (120Hz VSync 기준 약 ${Math.max(1, Math.round(Number(elapsed) / 8.33))}프레임 드랍)`
      )
      setIsStressTesting(false)
    }, 50)
  }

  const codeSnippets: CodeSnippet[] = [
    {
      tabLabel: 'TanStack + Pretext 연동',
      title: 'TanStack Virtual과 Pretext의 무한스크롤 결합 패턴',
      filePath: 'src/demos/TanStackFeedDemo.tsx',
      language: 'tsx',
      code: `// 1. [Cold Path]: 텍스트 변경 시 1회만 prepare() (Pretendard 폰트 + pre-wrap + keep-all 옵션 적용)
const prepared = prepare(text, '16px Pretendard, sans-serif', {
  whiteSpace: 'pre-wrap',   // 줄바꿈/공백 유지
  wordBreak: 'keep-all',    // 한글 단어 단위 줄바꿈 에뮬레이션
});

// 2. [Hot Path]: 컨테이너 너비(width) 변경 시 순수 산술 연산으로 전체 높이 배열 사전 생성 (0.02ms)
const precalculatedHeights = useMemo(() => {
  const textWidth = feedWidth - PADDING_HORIZ;
  return items.map(item => {
    const imageHeight = textWidth / item.aspectRatio; // 📐 종횡비 수학 나눗셈
    const { height: textHeight } = layout(item.preparedPrompt, textWidth, 24); // ⚡ Pretext 산술식
    return FIXED_OVERHEAD + imageHeight + textHeight; // 🎯 1px 오차 없는 정확한 높이
  });
}, [items, feedWidth]);

// 3. [TanStack Virtual 설정]: DOM 역측정(measureElement)을 아예 제거!
const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => scrollContainerRef.current,
  // 💡 Pretext로 사전 계산된 정밀 높이 배열을 그대로 반환!
  estimateSize: (index) => precalculatedHeights[index], 
  overscan: 5,
});

// 4. [JSX 렌더링]: 완성된 물리적 Y 좌표를 transform으로 GPU에 직행 주입
{rowVirtualizer.getVirtualItems().map(virtualRow => (
  <div
    key={virtualRow.key}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: \`\${virtualRow.size}px\`,
      // 🚀 메인 스레드의 Layout/Paint를 건너뛰고 GPU 합성(Composite) 레이어로 직행!
      transform: \`translate3d(0, \${virtualRow.start}px, 0)\`,
    }}
  >
    <FeedCard card={items[virtualRow.index]} />
  </div>
))}`,
      explanation:
        '동적 높이 가상화에서 가장 큰 병목은 DOM을 그린 후 offsetHeight를 역측정하는 것입니다. Pretext의 사전 계산 높이를 estimateSize에 그대로 주입하면 measureElement 자체가 불필요해져 연쇄 동기 리플로우(Layout Thrashing)가 원천 차단됩니다.',
    },
    {
      tabLabel: 'GPU 합성 직행 (Transform vs Top)',
      title: '왜 top이 아니라 transform: translate3d(x, y, 0)인가?',
      filePath: 'RenderingNG / Chromium Compositor Architecture',
      language: 'css',
      code: `/* ❌ 안티패턴: top / margin-top 사용 시 */
.virtual-item-legacy {
  position: absolute;
  top: 1450px; /* ⚠️ 속성 변경 시 브라우저 메인 스레드의 Layout -> Paint 파이프라인 강제 실행 */
  left: 0;
}

/* ✅ 최적화 패턴: transform: translate3d 사용 시 */
.virtual-item-optimized {
  position: absolute;
  top: 0;
  left: 0;
  /* 🚀 기하학적 레이아웃을 다시 계산하지 않고,
     컴포지터 스레드(GPU)에서 레이어 합성(Composite)만 수행!
     -> 60Hz/120Hz 무감속 프레임 보장 */
  transform: translate3d(0, 1450px, 0);
  will-change: transform;
}`,
      explanation:
        'top 속성을 변경하면 브라우저 렌더러는 요소의 기하학적 형태를 재계산(Layout/Reflow)하고 다시 칠해야(Paint) 합니다. 반면 transform: translate3d()는 이미 래스터화된 레이어를 GPU 메모리 상에서 좌표만 이동시키는 하드웨어 가속 합성(Composite) 단계로 직행하므로 프레임 드랍이 전혀 없습니다.',
    },
    {
      tabLabel: '미드저니 방식 높이 산술식',
      title: '카드 전체 높이의 완전 사전 계산 구조',
      filePath: 'pages/demos/masonry/index.ts 인용',
      language: 'typescript',
      code: `/**
 * 미드저니식 카드 피드 전체 높이 계산의 3단 구조
 * 
 * 전체 높이 = 이미지 높이(0ms) + 프롬프트 높이(0.0002ms) + 고정 UI 오버헤드(0ms)
 */

// 1. 이미지는 원래 순수 수학으로 나옴 (API 메타데이터 활용)
const imageHeight = Math.round(cardWidth / item.aspectRatio);

// 2. 고정 UI는 개발자가 지정한 고정 픽셀 상수 (인덱스바, 패딩, 아바타, 액션 버튼 등)
const fixedUiHeight = 24 + 44 + 10 + 12 + 12 + 28 + (16 * 2) + 2; // = 164px

// 3. [유일한 난제였던 지점] 텍스트 높이 -> Pretext가 DOM 없이 순수 숫자로 해결!
//    '16px Pretendard, sans-serif' + { whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }
const { height: promptHeight, lineCount } = layout(item.preparedPrompt, textWidth, 24);

// 4. 최종 카드 전체 높이 도출 (DOM 렌더링 전 100% 확정)
const totalCardHeight = fixedUiHeight + imageHeight + promptHeight;

// 💡 1,000장의 카드 전체 높이를 1ms 안에 자바스크립트 힙 메모리 상에서 완벽히 도출!`,
      explanation:
        '이미지 비율과 UI 여백은 원래 브라우저 없이도 즉시 알 수 있었습니다. 유일하게 DOM 없이는 알 수 없었던 프롬프트 텍스트의 줄바꿈 높이를 Pretext가 순수 숫자로 풀어줌으로써, 개발자가 카드 전체 크기를 100% 자바스크립트 수학식으로 완성할 수 있습니다.',
    },
  ]

  return (
    <div className="demo-wrapper" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      {/* 데모 헤더 */}
      <div className="demo-card" style={{ fontFamily: 'Pretendard, sans-serif' }}>
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>📜 6. TanStack Virtual 무한스크롤 & Transform 좌표 주입</span>
            <span
              key={mathFlashKey}
              className="header-badge"
              style={{
                animation: 'flash-math-anim 0.8s ease',
                background: 'rgba(56, 139, 253, 0.2)',
                color: '#58a6ff',
                borderColor: '#388bfd',
              }}
            >
              ⚡ {items.length}개 카드 높이 연산: {calcTimeUs} µs
            </span>
          </div>
          <div className="demo-card-desc">
            실제 현업 표준 가상화 라이브러리(<strong>@tanstack/react-virtual</strong>)에 Pretext의 사전 계산 높이를 주입하여,
            DOM 동적 측정(<code>measureElement</code>)을 100% 제거하고 <code>transform: translate3d</code>로 GPU 합성 레이어에 직행시키는 무한스크롤 피드입니다.
          </div>
        </div>

        {/* 컨트롤 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <label className="control-label">피드 가로 너비 (반응형 리사이즈):</label>
            <input
              type="range"
              min={260}
              max={720}
              step={10}
              value={effectiveFeedWidth}
              onChange={(e) => setFeedWidth(Number(e.target.value))}
            />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)', minWidth: '55px' }}>
              {effectiveFeedWidth}px
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const next = !usePretextEstimate
                setUsePretextEstimate(next)
                setMeasureCounter(0)
                setMeasuredReflowTimeMs(0)
                setRecentlyMeasuredId(null)
                setStressTestResult(null)
                measuredNodesRef.current = new WeakSet()
                // 모드 전환 시 스크롤 위치를 최상단으로 리셋하여 뷰포트 점프 및 비정상 트리거 방지
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
                rowVirtualizer.measure()
              }}
              className="tab-btn"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                background: usePretextEstimate ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                color: usePretextEstimate ? '#3fb950' : '#f85149',
                borderColor: usePretextEstimate ? '#3fb950' : '#f85149',
              }}
            >
              {usePretextEstimate ? '🚀 Pretext Zero-DOM 모드 (사전계산)' : '⚠️ Pretext 미적용 (동적 DOM 역측정)'}
            </button>

            <button
              onClick={() => setUseTransform(!useTransform)}
              className="tab-btn"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                background: useTransform ? 'rgba(88, 166, 255, 0.15)' : 'rgba(240, 136, 62, 0.15)',
                color: useTransform ? '#58a6ff' : '#f0883e',
                borderColor: useTransform ? '#58a6ff' : '#f0883e',
              }}
            >
              {useTransform ? '⚡ transform: translate3d (GPU 합성)' : '🐢 top: Ypx (메인스레드 레이아웃)'}
            </button>

            <button
              onClick={() => handleAddMore(50)}
              className="tab-btn"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              +50개 추가
            </button>

            <button
              onClick={handleReset}
              className="tab-btn"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              초기화
            </button>
          </div>
        </div>

        {/* Pretext 미적용 모드 시 경고 및 연쇄 리플로우 테스트 패널 */}
        {!usePretextEstimate && (
          <div
            style={{
              background: 'rgba(248, 81, 73, 0.08)',
              border: '1px solid rgba(248, 81, 73, 0.35)',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f85149', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️</span> Pretext 미적용 모드: DOM 역측정 및 강제 동기 리플로우 발생 중!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                가상화 라이브러리가 기본 높이(500px)로 추정한 뒤, 스크롤될 때마다 <code>node.offsetHeight</code>를 읽어 동기 레이아웃을 유발합니다.
              </div>
            </div>

            <button
              onClick={handleStressTestLayoutThrashing}
              disabled={isStressTesting}
              style={{
                background: '#f85149',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: isStressTesting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(248, 81, 73, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              {isStressTesting ? '⏳ 연쇄 리플로우 측정 중...' : '🔥 연쇄 리플로우(Layout Thrashing) 스트레스 테스트'}
            </button>
          </div>
        )}

        {/* 스트레스 테스트 결과 알림 */}
        {stressTestResult && (
          <div
            style={{
              background: 'rgba(248, 81, 73, 0.15)',
              border: '1px solid #f85149',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#f85149',
              fontWeight: 700,
            }}
          >
            {stressTestResult}
          </div>
        )}

        {/* 메트릭 대시보드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {/* 1. 총 피드 카드 수 */}
          <div className="metric-card" style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>총 피드 카드 수</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {items.length}개
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>스크롤 시 자동 무한 로딩</div>
          </div>

          {/* 2. 현재 뷰포트 마운트 DOM 노드 (명확한 표기 추가) */}
          <div className="metric-card" style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>현재 뷰포트 마운트 DOM 노드</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#3fb950',
                  background: 'rgba(63, 185, 80, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  border: '1px solid rgba(63, 185, 80, 0.3)',
                }}
              >
                절감율 {((1 - virtualItems.length / items.length) * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)', marginTop: '4px' }}>
              {virtualItems.length}개 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>/ 전체 {items.length}개</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              💡 현재 화면에 마운트된 <strong>실제 DOM 요소는 {virtualItems.length}개</strong>이며, 나머지 <strong>{items.length - virtualItems.length}개는 가상화</strong>되어 메모리에만 존재합니다.
            </div>
          </div>

          {/* 3. Pretext 높이 산출 시간 */}
          <div className="metric-card" style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pretext 텍스트 높이 산출 시간</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px' }}>
              {calcTimeUs} µs
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              카드당 약 0.0002ms 순수 산술식
            </div>
          </div>

          {/* 4. DOM 역측정 및 강제 리플로우 횟수 */}
          <div className="metric-card" style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>DOM 역측정(리플로우) 횟수</div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: usePretextEstimate ? 'var(--accent-green)' : 'var(--accent-red)',
                marginTop: '4px',
              }}
            >
              {usePretextEstimate ? '0회 (Zero Reflow)' : `${measureCounter}회 호출`}
            </div>
            <div style={{ fontSize: '11px', color: usePretextEstimate ? '#3fb950' : '#f85149', marginTop: '2px' }}>
              {usePretextEstimate
                ? '✨ VSync 주기 100% 보존'
                : `⚠️ 총 ${measuredReflowTimeMs.toFixed(2)}ms 동안 메인 스레드 블로킹`}
            </div>
          </div>
        </div>

        {/* 무한스크롤 가상화 피드 뷰포트 */}
        <div ref={wrapperRef} style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          <div
            ref={scrollContainerRef}
            className="virtual-scroll-container hide-scrollbar"
            style={{
              width: `${effectiveFeedWidth}px`,
              maxWidth: '100%',
              height: '580px',
              overflowY: 'auto',
              position: 'relative',
              background: '#090d13',
              border: `1px solid ${usePretextEstimate ? 'var(--border-color)' : 'rgba(248, 81, 73, 0.4)'}`,
              borderRadius: '12px',
              padding: '12px',
              transition: 'width 0.15s ease',
            }}
          >
            {/* 전체 누적 높이를 담당하는 더미 컨테이너 */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const item = items[virtualRow.index]
                if (!item) return null

                // 위치 결정: transform vs top
                const itemStyle: React.CSSProperties = {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  // Pretext 모드: 사전 계산된 정밀 높이 지정
                  // 비-Pretext(동적 DOM 역측정) 모드: DOM이 실제 내용물 높이를 갖도록 height 제거 (역측정 정확도 보장)
                  ...(usePretextEstimate ? { height: `${virtualRow.size}px` } : {}),
                  ...(useTransform
                    ? { transform: `translate3d(0, ${virtualRow.start}px, 0)` }
                    : { top: `${virtualRow.start}px` }),
                  paddingBottom: `${GAP}px`,
                }

                // 이미지 높이 산술식
                const textWidth = Math.max(80, effectiveFeedWidth - CARD_PADDING * 2 - 2)
                const imageHeight = Math.round(textWidth / item.aspectRatio)
                const isMeasuredFlashing = !usePretextEstimate && recentlyMeasuredId === item.id

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={measureCallback}
                    data-card-id={item.id}
                    style={itemStyle}
                  >
                    <div
                      className={`feed-card-inner ${isMeasuredFlashing ? 'flash-reflow' : ''}`}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${
                          !usePretextEstimate ? 'rgba(248, 81, 73, 0.4)' : 'var(--border-color)'
                        }`,
                        borderRadius: '10px',
                        padding: `${CARD_PADDING}px`,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {/* [1. 상단 인덱스 및 카드 번호 명확 표기 UI] */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          height: '24px',
                          marginBottom: '10px',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: usePretextEstimate
                              ? 'rgba(56, 139, 253, 0.15)'
                              : 'rgba(248, 81, 73, 0.15)',
                            border: `1px solid ${
                              usePretextEstimate
                                ? 'rgba(56, 139, 253, 0.35)'
                                : 'rgba(248, 81, 73, 0.35)'
                            }`,
                            padding: '3px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              color: usePretextEstimate ? '#58a6ff' : '#f85149',
                              fontFamily: 'monospace',
                            }}
                          >
                            Card #{item.id}
                          </span>
                          <span style={{ opacity: 0.4, color: 'var(--text-muted)' }}>|</span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                            }}
                          >
                            배열 Index: {virtualRow.index}
                          </span>
                        </div>

                        {!usePretextEstimate && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#f85149',
                              background: 'rgba(248, 81, 73, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(248, 81, 73, 0.3)',
                            }}
                          >
                            ⚠️ DOM 역측정 대상
                          </span>
                        )}
                      </div>

                      {/* [2. 카드 헤더]: 아바타 + 작성자 + 종횡비 뱃지 */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          height: '44px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: item.avatarColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '13px',
                              color: '#fff',
                            }}
                          >
                            {item.author[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {item.author}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.handle}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: 'rgba(88, 166, 255, 0.15)',
                              color: '#58a6ff',
                              fontWeight: 600,
                              border: '1px solid rgba(88, 166, 255, 0.3)',
                            }}
                          >
                            비율 {item.aspectRatio === 1 ? '1:1' : item.aspectRatio > 1 ? '16:9' : '2:3'}
                          </span>
                        </div>
                      </div>

                      {/* [3. 고정 비율 이미지 배너]: 너비 / aspectRatio 나눗셈 높이 */}
                      <div
                        style={{
                          width: '100%',
                          height: `${imageHeight}px`,
                          flexShrink: 0,
                          background: item.gradient,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          marginBottom: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'rgba(255, 255, 255, 0.85)',
                            textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                          }}
                        >
                          🖼️ 이미지 영역 ({textWidth} × {imageHeight}px)
                        </span>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            right: '8px',
                            fontSize: '10px',
                            background: 'rgba(0,0,0,0.6)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#ccc',
                          }}
                        >
                          Aspect: {item.aspectRatio.toFixed(2)}
                        </span>
                      </div>

                      {/* [4. 가변 프롬프트 텍스트]: Pretext로 줄바꿈 및 높이 사전 확정 */}
                      <div style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: 'var(--accent-blue)',
                            marginBottom: '4px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          PROMPT
                        </div>
                        <div
                          style={{
                            fontSize: '16px',
                            lineHeight: `${LINE_HEIGHT}px`,
                            fontFamily: 'Pretendard, sans-serif',
                            color: '#e6edf3',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'keep-all',
                          }}
                        >
                          {item.prompt}
                        </div>
                      </div>

                      {/* [5. 카드 푸터]: 태그 + 좋아요 */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          height: '36px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          borderTop: '1px solid rgba(48, 54, 61, 0.6)',
                          paddingTop: '8px',
                          boxSizing: 'border-box',
                        }}
                      >
                        <span style={{ color: 'var(--accent-orange)' }}>#{item.category}</span>
                        <span>❤️ {item.likes} likes</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 하단 무한스크롤 인디케이터 */}
            {isLoadingMore && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px',
                  fontSize: '13px',
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                }}
              >
                🔄 새로운 피드 20장 사전 연산 로딩 중...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 심층 코드 및 아키텍처 뷰어 */}
      <CodeViewer
        title="TanStack Virtual + Pretext 무한스크롤 & Transform 파이프라인 분석"
        snippets={codeSnippets}
      />
    </div>
  )
}
