import React, { useState, useMemo, useRef, useEffect } from 'react'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer, type CodeSnippet } from '../components/CodeViewer'

interface AccordionSection {
  id: string
  title: string
  text: string
  tag: string
}

const SECTIONS: AccordionSection[] = [
  {
    id: 'shipping',
    title: 'Section 1: 제품 릴리스와 신중한 서술',
    tag: 'Release',
    text:
      'Mina cut the release note to three crisp lines, then realized the support caveat still needed one more sentence before it could ship without surprises. 제품 출시 전 예외 조항과 지원 브라우저 범위를 명확히 명시하지 않으면 사용자의 신뢰를 잃을 수 있습니다.',
  },
  {
    id: 'ops',
    title: 'Section 2: 장애 대응 체크리스트 표준화',
    tag: 'Operations',
    text:
      'The handoff doc now reads like a proper morning checklist instead of a diary entry. Restart the worker, verify the queue drains, and only then mark the incident quiet. If the backlog grows again, page the same owner instead of opening a new thread. 운영 환경의 복잡도를 낮추는 최고의 방법은 프로세스의 명문화입니다.',
  },
  {
    id: 'research',
    title: 'Section 3: 가상 스크롤 렌더링 병목 해결',
    tag: 'Architecture',
    text:
      'We learned the hard way that a giant native scroll range can dominate everything else. The bug looked like DOM churn, then like pooling, then like rendering pressure, until the repros were stripped down enough to show the real limit. That changed the fix completely: simplify the DOM, keep virtualization honest, and stop hiding the worst-case path behind caches that only make the common frame look cheaper.',
  },
  {
    id: 'mixed',
    title: 'Section 4: 다국어(CJK, 아랍어 RTL) & 이모지 래핑',
    tag: 'Multilingual',
    text:
      'AGI 春天到了. بدأت الرحلة 🚀 and the long URL is https://example.com/reports/q3?lang=ar&mode=full. Nora wrote “please keep 10\u202F000 rows visible,” Mina replied “trans\u00ADatlantic labels are still weird.” 복잡한 유니코드 합자 및 양방향 텍스트에서도 1px의 오차 없이 정확한 줄바꿈 높이를 산출합니다.',
  },
]

const FONT = '15px "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const LINE_HEIGHT = 24
const INNER_PADDING_X = 20
const INNER_PADDING_TOP = 4
const INNER_PADDING_BOTTOM = 18
const PADDING_Y = INNER_PADDING_TOP + INNER_PADDING_BOTTOM // 22px

export const AccordionDemo: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('shipping')
  const [containerWidth, setContainerWidth] = useState<number>(560)
  const [mode, setMode] = useState<'pretext' | 'dom'>('pretext')
  const [reflowCount, setReflowCount] = useState<number>(0)
  const [lastReflowElapsedUs, setLastReflowElapsedUs] = useState<string>('0')
  const [mathFlashKey, setMathFlashKey] = useState<number>(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const bodyRefs = useRef<Map<string, HTMLDivElement>>(new Map())
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

  const effectiveWidth = Math.max(300, Math.min(containerWidth, maxAvailableWidth))
  // 아코디언 본문 텍스트의 가용 내부 너비 = 컨테이너 너비 - 양쪽 테두리(2px) - 좌우 패딩(40px)
  const contentWidth = Math.max(100, effectiveWidth - 2 - INNER_PADDING_X * 2)

  // ============================================================================
  // [Cold Path]: 1회성 전처리 (텍스트와 폰트 기준 분절 및 캐싱)
  // ============================================================================
  const preparedMap = useMemo<Map<string, PreparedText>>(() => {
    const map = new Map<string, PreparedText>()
    for (const s of SECTIONS) {
      map.set(s.id, prepare(s.text, FONT))
    }
    return map
  }, [])

  // ============================================================================
  // [Hot Path]: 컨테이너 너비 변경 시 순수 산술 연산으로 각 섹션의 정밀 높이 사전 산출
  // ============================================================================
  const { heightsMap, linesMap, calcTimeUs } = useMemo(() => {
    const t0 = performance.now()
    const hMap = new Map<string, number>()
    const lMap = new Map<string, number>()

    for (const s of SECTIONS) {
      const prep = preparedMap.get(s.id)!
      const result = layout(prep, contentWidth, LINE_HEIGHT)
      // 총 패널 높이 = 텍스트 줄바꿈 높이 + 상하 내부 패딩(22px)
      hMap.set(s.id, Math.ceil(result.height + PADDING_Y))
      lMap.set(s.id, result.lineCount)
    }

    const t1 = performance.now()
    setMathFlashKey((prev) => prev + 1)
    return {
      heightsMap: hMap,
      linesMap: lMap,
      calcTimeUs: ((t1 - t0) * 1000).toFixed(2),
    }
  }, [preparedMap, contentWidth])

  // 토글 클릭 핸들러
  const handleToggle = (id: string) => {
    if (mode === 'dom') {
      // 💥 기존 안티패턴: 열기 전 DOM의 scrollHeight를 직접 조회 -> 동기 리플로우 발생!
      const el = bodyRefs.current.get(id)
      if (el) {
        const t0 = performance.now()
        const _sh = el.scrollHeight // Force Sync Layout (Document::UpdateStyleAndLayout)
        const t1 = performance.now()
        setLastReflowElapsedUs(((t1 - t0) * 1000).toFixed(2))
        setReflowCount((prev) => prev + 1)
      }
    }
    setOpenId((prev) => (prev === id ? null : id))
  }

  const codeSnippets: CodeSnippet[] = [
    {
      tabLabel: '📱 컴포넌트 구현 코드',
      title: 'Pretext 기반 Zero-Reflow 아코디언 컴포넌트',
      filePath: 'src/demos/AccordionDemo.tsx',
      language: 'tsx',
      code: `import React, { useState, useMemo } from 'react';
import { prepare, layout, type PreparedText } from '@chenglou/pretext';

const FONT = '15px "Pretendard", sans-serif';
const LINE_HEIGHT = 24;
const PADDING_Y = 22; // 상하 내부 여백

export function Accordion({ sections, containerWidth }) {
  const [openId, setOpenId] = useState<string | null>(sections[0].id);

  // 1. [Cold Path]: 텍스트 변경 시 1회만 prepare() 호출
  const preparedMap = useMemo(() => {
    const map = new Map<string, PreparedText>();
    sections.forEach(s => map.set(s.id, prepare(s.text, FONT)));
    return map;
  }, [sections]);

  // 2. [Hot Path]: 너비 변경 시 순수 산술식으로 각 섹션 목표 높이 사전 계산 (~0.2µs)
  const heightsMap = useMemo(() => {
    const textWidth = containerWidth - 42; // 테두리 및 좌우 패딩 차감
    const map = new Map<string, number>();
    sections.forEach(s => {
      const { height } = layout(preparedMap.get(s.id)!, textWidth, LINE_HEIGHT);
      map.set(s.id, Math.ceil(height + PADDING_Y));
    });
    return map;
  }, [preparedMap, containerWidth]);

  return (
    <div className="accordion-stack">
      {sections.map(section => {
        const isOpen = openId === section.id;
        const targetHeight = heightsMap.get(section.id) ?? 0;

        return (
          <div key={section.id} className="accordion-item">
            <button
              className="accordion-toggle"
              onClick={() => setOpenId(isOpen ? null : section.id)}
              aria-expanded={isOpen}
            >
              <span>{section.title}</span>
              <span className="glyph" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            </button>

            {/* ⚡ DOM scrollHeight 측정 없이 순수 산술 높이로 100% 매끄러운 CSS transition 실행 */}
            <div
              className="accordion-body"
              style={{
                height: isOpen ? \`\${targetHeight}px\` : '0px',
                overflow: 'clip',
                transition: 'height 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div className="accordion-inner">
                <p>{section.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}`,
      explanation:
        'CSS height: auto는 transition이 되지 않아 보통 scrollHeight를 읽거나 max-height 트릭을 씁니다. Pretext를 쓰면 DOM 조회 0회로 정확한 타겟 높이를 마이크로초 단위에 계산해 완벽한 CSS height transition을 구현합니다.',
    },
    {
      tabLabel: '🔬 공식 라이브러리 데모 원리',
      title: '공식 pretext/pages/demos/accordion.ts 아키텍처',
      filePath: 'pretext/pages/demos/accordion.ts',
      language: 'typescript',
      code: `// ============================================================================
// [공식 pretext/pages/demos/accordion.ts 아키텍처 발췌]
// ============================================================================
import { layout, prepare, type PreparedText } from '@chenglou/pretext';

function renderAccordion(items, contentWidth, lineHeight, paddingY, openItemId) {
  // 1. DOM의 렌더 트리를 읽지 않고, 순수 메모리 상에서 모든 패널의 정밀 높이 배열 도출
  const panelHeights: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const metrics = layout(preparedCache.items[i]!, contentWidth, lineHeight);
    panelHeights.push(Math.ceil(metrics.height + paddingY));
  }

  // 2. 브라우저 렌더러에게 즉시 목표 픽셀 높이 주입 -> 하드웨어 가속 트랜지션 실행
  for (let i = 0; i < items.length; i++) {
    const expanded = openItemId === items[i].id;
    const body = domCache.items[i].body;
    
    // 💡 0 DOM Reflow: scrollHeight나 offsetHeight 조회가 전혀 없음!
    body.style.height = expanded ? \`\${panelHeights[i]}px\` : '0px';
  }
}`,
      explanation:
        '공식 pretext 아코디언 데모는 폰트와 스타일을 파악한 후, 렌더 루프(rAF) 안에서 layout()만으로 모든 패널 높이를 구합니다. 브라우저의 레이아웃 무효화 큐를 건드리지 않으므로 고주사율 모니터에서도 프레임 드랍이 전혀 없습니다.',
    },
    {
      tabLabel: '⚖️ 기존 웹 구현의 한계 vs Pretext',
      title: '3가지 아코디언 구현 방식 비교 분석',
      filePath: 'Web Animation Performance Comparison',
      language: 'markdown',
      code: `### 1. ❌ CSS max-height: 1000px 트릭
- **원리**: 정확한 높이를 몰라 충분히 큰 값(e.g. 1000px)으로 transition 지정.
- **문제점**:
  - 실제 내용물이 80px일 때도 1000px을 기준으로 애니메이션 시간이 분배됨.
  - 열릴 때는 급발진하듯 빠르게 열리고, **닫힐 때는 1000px -> 80px까지 내려오는 동안 화면에 아무런 움직임 없는 멈춤(딜레이) 현상** 발생!

---

### 2. ❌ JS scrollHeight 동기 측정 (Naive 방식)
- **원리**: 클릭 시 \`element.scrollHeight\`를 읽어 인라인 픽셀을 지정.
- **문제점**:
  - \`scrollHeight\`를 읽는 순간 브라우저는 화면 그리기를 중단하고 즉시 **강제 동기 레이아웃(Forced Layout / Reflow)** 실행.
  - 저사양 기기나 복잡한 페이지에서 클릭 순간 버벅임(Jank) 유발.

---

### 3. ✅ Pretext 사전 계산 (Zero-Reflow 방식)
- **원리**: \`layout(prepared, width, lineHeight)\`로 순수 산술식 높이를 도출하여 지정.
- **장점**:
  - **정확성**: 1px의 오차도 없는 실제 타겟 높이로 애니메이션 시간(duration)이 균일함.
  - **성능**: DOM 읽기 0회! VSync 프레임 예산을 전혀 침범하지 않고 120fps 유지.
  - **반응형**: 브라우저 창 크기가 변해도 실시간으로 목표 높이가 마이크로초 단위 재계산됨.`,
      explanation:
        'CSS의 한계와 브라우저 강제 리플로우를 동시에 극복하는 가장 현대적인 아코디언 구현 기법입니다.',
    },
  ]

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>🪗 DOM 측정 없는 무결점 아코디언 (Zero Reflow Accordion)</span>
            <span
              key={mathFlashKey}
              className="header-badge"
              style={{
                background: 'rgba(56, 139, 253, 0.2)',
                color: '#58a6ff',
                borderColor: '#388bfd',
              }}
            >
              ⚡ 4개 섹션 높이 연산: {calcTimeUs} µs
            </span>
          </div>
          <div className="demo-card-desc">
            <code>height: auto</code>에는 CSS transition이 동작하지 않아 생기는 웹의 고질적 난제를,
            Pretext의 순수 산술 연산(<code>layout()</code>)으로 DOM 조회(<code>scrollHeight</code>) 없이
            100% 매끄러운 높이 애니메이션으로 해결합니다.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <label className="control-label">아코디언 가로 너비 (반응형 리사이즈):</label>
            <input
              type="range"
              min={300}
              max={720}
              step={10}
              value={effectiveWidth}
              onChange={(e) => setContainerWidth(Number(e.target.value))}
            />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)', minWidth: '55px' }}>
              {effectiveWidth}px
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setMode(mode === 'pretext' ? 'dom' : 'pretext')}
              className="tab-btn"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                background: mode === 'pretext' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                color: mode === 'pretext' ? '#3fb950' : '#f85149',
                borderColor: mode === 'pretext' ? '#3fb950' : '#f85149',
              }}
            >
              {mode === 'pretext' ? '🚀 Pretext 모드 (Zero Reflow)' : '💥 기존 Naive 모드 (scrollHeight 측정)'}
            </button>

            <button
              onClick={() => setOpenId(null)}
              className="tab-btn"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              모두 접기
            </button>
          </div>
        </div>

        {/* 메트릭 정보 배지 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div className="metric-pill info">
            <span>Pretext 연산 속도:</span>
            <strong>{calcTimeUs} µs</strong>
          </div>
          <div className={`metric-pill ${reflowCount > 0 ? 'danger' : ''}`}>
            <span>누적 강제 리플로우:</span>
            <strong>{mode === 'pretext' ? '0회 (차단됨)' : `${reflowCount}회 (소요: ${lastReflowElapsedUs}µs)`}</strong>
          </div>
          <div className="metric-pill">
            <span>텍스트 가용 폭:</span>
            <strong>{contentWidth}px</strong>
          </div>
        </div>

        {/* 인터랙티브 아코디언 컴포넌트 뷰포트 */}
        <div ref={wrapperRef} style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', margin: '0 auto' }}>
          <div
            style={{
              width: `${effectiveWidth}px`,
              maxWidth: '100%',
              margin: '0 auto',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              transition: 'width 0.15s ease',
            }}
          >
            {SECTIONS.map((section, idx) => {
              const isOpen = openId === section.id
              const targetHeight = heightsMap.get(section.id) ?? 0
              const lineCount = linesMap.get(section.id) ?? 0

              return (
                <div
                  key={section.id}
                  style={{
                    borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  {/* 아코디언 헤더 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleToggle(section.id)}
                    aria-expanded={isOpen}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                      gap: '12px',
                      alignItems: 'center',
                      width: '100%',
                      padding: '16px 20px',
                      border: 0,
                      background: isOpen ? 'rgba(88, 166, 255, 0.05)' : 'transparent',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{section.title}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(88, 166, 255, 0.15)',
                            color: '#58a6ff',
                          }}
                        >
                          {section.tag}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lineCount}줄 · {targetHeight}px
                    </div>

                    {/* 회전 글리프 */}
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: '18px',
                        height: '18px',
                        color: isOpen ? 'var(--accent-blue)' : 'var(--text-muted)',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 180ms ease, color 0.18s ease',
                      }}
                    >
                      <span style={{ fontSize: '10px' }}>▶</span>
                    </div>
                  </button>

                  {/* 아코디언 본문 (Pretext 정밀 높이 주입 & 부드러운 CSS transition) */}
                  <div
                    ref={(el) => {
                      if (el) bodyRefs.current.set(section.id, el)
                      else bodyRefs.current.delete(section.id)
                    }}
                    style={{
                      height: isOpen ? `${targetHeight}px` : '0px',
                      overflow: 'clip',
                      transition: 'height 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                      willChange: 'height',
                    }}
                  >
                    <div
                      style={{
                        padding: `${INNER_PADDING_TOP}px ${INNER_PADDING_X}px ${INNER_PADDING_BOTTOM}px`,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          font: FONT,
                          lineHeight: `${LINE_HEIGHT}px`,
                          color: '#c9d1d9',
                          wordBreak: 'break-word',
                        }}
                      >
                        {section.text}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 심층 소스 코드 뷰어 */}
      <CodeViewer
        title="Zero-Reflow 아코디언 높이 연산 & 애니메이션 아키텍처"
        snippets={codeSnippets}
      />
    </div>
  )
}
