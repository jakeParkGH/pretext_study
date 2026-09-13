import React, { useState, useMemo, useRef, useEffect } from 'react'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

const SAMPLE_TEXT = `웹 프론트엔드 개발에서 텍스트의 크기와 줄바꿈에 따른 높이를 계산하는 작업은 언제나 브라우저 렌더링 파이프라인의 심각한 병목이었습니다. 가상 스크롤, 메이슨리 그리드, AI 실시간 스트리밍 인터페이스 등에서는 요소가 화면에 나타나기 전 정확한 크기를 알아야 레이아웃 시프트(CLS)를 방지할 수 있습니다. Pretext는 DOM을 건드리지 않고 순수 수학 연산만으로 이를 마이크로초(µs) 단위에 해결합니다.`

const FONT = '16px "Pretendard", -apple-system, sans-serif'
const LINE_HEIGHT = 26

export const BasicMeasureDemo: React.FC = () => {
  const [containerWidth, setContainerWidth] = useState<number>(360)
  const [text, setText] = useState<string>(SAMPLE_TEXT)
  const domTargetRef = useRef<HTMLDivElement>(null)

  // ============================================================================
  // [Cold Path]: 1회성 전처리 (데이터 변경 시에만 실행)
  // ============================================================================
  // prepare()는 무거운 문자열 분절(Intl.Segmenter) 및 OffscreenCanvas 1회 측정을 수행합니다.
  // 이 결과는 불변 Opaque 핸들(PreparedText)로 반환되어 메모리에 보관됩니다.
  // 윈도우 리사이즈나 너비 변화 시 절대 prepare()를 다시 호출하면 안 됩니다!
  const prepared: PreparedText = useMemo(() => {
    return prepare(text, FONT)
  }, [text])

  // ============================================================================
  // [Hot Path]: 실시간 반복 실행 (너비 변경 시마다 마이크로초 단위 연산)
  // ============================================================================
  // layout()은 DOM API나 Canvas를 전혀 호출하지 않는 100% 순수 산술 연산입니다.
  // 너비 슬라이더를 마구 움직여도 60fps / 120fps를 안정적으로 유지합니다.
  const [mathFlashKey, setMathFlashKey] = useState<number>(0)
  const pretextResult = useMemo(() => {
    const start = performance.now()
    const result = layout(prepared, containerWidth, LINE_HEIGHT)
    const elapsedMs = performance.now() - start
    setMathFlashKey((prev) => prev + 1)
    return { ...result, elapsedUs: (elapsedMs * 1000).toFixed(2) }
  }, [prepared, containerWidth])

  // 비교군: 기존 DOM 기반 측정 (Forced Synchronous Layout 발생)
  const [domMeasuredHeight, setDomMeasuredHeight] = useState<number>(0)
  const [domElapsedUs, setDomElapsedUs] = useState<string>('0')
  const [domFlashKey, setDomFlashKey] = useState<number>(0)
  const [totalReflowCount, setTotalReflowCount] = useState<number>(0)

  useEffect(() => {
    if (!domTargetRef.current) return
    const start = performance.now()
    // DOM의 offsetHeight를 읽는 순간 브라우저 내부 큐에 쌓인 변경사항이 강제 플러시(Hard Reflow)됨
    const h = domTargetRef.current.offsetHeight
    const elapsedMs = performance.now() - start
    setDomMeasuredHeight(h)
    setDomElapsedUs((elapsedMs * 1000).toFixed(2))
    setDomFlashKey((prev) => prev + 1)
    setTotalReflowCount((prev) => prev + 1)
  }, [containerWidth, text])

  const basicCodeSample = `// -------------------------------------------------------------
// [Pretext 기본 해결 패턴: 2-Phase Engine]
// -------------------------------------------------------------
import { prepare, layout } from '@chenglou/pretext'

const FONT = '16px "Pretendard", -apple-system, sans-serif';
const LINE_HEIGHT = 26;

// [Phase 1: Cold Path - 1회성 전처리]
// 1. 유니코드 세그멘테이션 (단어/공백/글리프 분절)
// 2. OffscreenCanvas를 통해 단어별 너비 1회 측정 및 캐싱
// 3. 반환값: 불변 병렬 배열을 담은 불투명 핸들 (PreparedText)
// ⚠️ 주의: 리사이즈 루프 안에서 호출하면 안 되며, 텍스트가 바뀔 때만 실행!
const prepared = prepare(text, FONT);

// [Phase 2: Hot Path - 순수 산술 연산]
// 1. DOM Query 0회, Canvas 호출 0회, 문자열 조작 0회
// 2. 캐시된 세그먼트 너비 배열을 단순 누적 합산 (lineW += width)
// 3. 소요 시간: 약 0.0002ms (0.2µs) - 윈도우 리사이즈 루프에서도 120fps 유지!
const { height, lineCount } = layout(prepared, containerWidth, LINE_HEIGHT);
`;

  const libraryCodeSample = `// -------------------------------------------------------------
// [@chenglou/pretext 내부 핵심 최적화 소스코드 발췌]
// -------------------------------------------------------------

// [1. pretext/src/measurement.ts: OffscreenCanvas로 DOM Invalidation 원천 차단]
let measureContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
const segmentMetricCaches = new Map<string, Map<string, SegmentMetrics>>();

function createMeasureContext(language: string | null) {
  // ⚡ 최적화 1: DOM 트리에 노드를 붙이지 않는 1x1 OffscreenCanvas 사용
  // -> 일반 document.createElement와 달리 브라우저의 레이아웃 무효화 큐(Invalidation Queue)에 영향을 주지 않음!
  if (typeof OffscreenCanvas !== 'undefined') {
    measureContext = new OffscreenCanvas(1, 1).getContext('2d')!;
    return measureContext;
  }
  if (typeof document !== 'undefined') {
    measureContext = document.createElement('canvas').getContext('2d')!;
    return measureContext;
  }
  throw new Error('Text measurement requires OffscreenCanvas or a DOM canvas context.');
}

// [2. pretext/src/measurement.ts: 폰트별 / 단어별 2중 Map 캐싱]
export function getSegmentMetrics(seg: string, cache: Map<string, SegmentMetrics>): SegmentMetrics {
  // ⚡ 최적화 2: 이미 측정된 단어는 Canvas measureText()를 부르지 않고 O(1) 즉시 반환
  let metrics = cache.get(seg);
  if (metrics === undefined) {
    const ctx = getMeasureContext();
    metrics = { width: ctx.measureText(seg).width };
    cache.set(seg, metrics);
  }
  return metrics;
}

// [3. pretext/src/layout.ts: layout()의 초경량 Hot Path]
export function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult {
  // ⚡ 최적화 3: layoutWithLines()와 달리 줄 범위 객체나 문자열 생성을 완전히 배제!
  // 오직 줄 수(lineCount)만 순수 산술 누적 루프로 계산 (~0.0002ms)
  const lineCount = countPreparedLines(getInternalPrepared(prepared), maxWidth);
  return { lineCount, height: lineCount * lineHeight };
}

// [4. pretext/src/line-break.ts: walkPreparedLinesSimple() 산술 누적 루프]
function appendWholeSegment(segmentIndex: number, width: number): void {
  if (!hasContent) {
    startLineAtSegment(segmentIndex, width);
    return;
  }
  lineW += width; // ⚡ 숫자 덧셈으로만 다음 줄바꿈 지점 탐색 (CPU 집약적 단순 루프)
  lineEndSegmentIndex = segmentIndex + 1;
}
`;

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>❄️ Cold Path vs 🔥 Hot Path 성능 비교</span>
          </div>
          <div className="demo-card-desc">
            슬라이더로 컨테이너 너비를 조절하며 Pretext의 순수 산술 연산 속도와 실제 DOM 렌더링 결과 일치성을 확인해보세요.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <span className="control-label">컨테이너 너비: {containerWidth}px</span>
            <input
              type="range"
              min={200}
              max={650}
              value={containerWidth}
              onChange={(e) => setContainerWidth(Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="metric-pill info">
              ⚡ Pretext: {pretextResult.elapsedUs} µs
            </span>
            <span className="metric-pill">
              줄 수: {pretextResult.lineCount}줄 / {pretextResult.height}px
            </span>
            <span className="metric-pill danger">
              🔥 누적 Reflow: {totalReflowCount}회
            </span>
          </div>
        </div>

        {/* 인터랙티브 뷰포트 비교 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* Pretext 가상 예측 박스 */}
          <div style={{ background: '#090d13', padding: '16px', borderRadius: '8px', border: '1px solid #30363d', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '13px', color: '#58a6ff' }}>
                🚀 Pretext 사전 연산 (Zero DOM)
              </strong>
              <span className="pure-math-tag">
                ⚡ 0ms Pure Math
              </span>
            </div>
            <div
              key={`math-${mathFlashKey}`}
              className="flash-math"
              style={{
                width: `${containerWidth}px`,
                maxWidth: '100%',
                background: 'rgba(88, 166, 255, 0.05)',
                border: '1px dashed #58a6ff',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '16px',
                lineHeight: `${LINE_HEIGHT}px`,
                wordBreak: 'break-word',
                transition: 'border-color 0.2s',
              }}
            >
              {text}
            </div>
          </div>

          {/* 실제 브라우저 DOM 렌더링 박스 (강제 리플로우 시 빨간색 플래시 발동) */}
          <div style={{ background: '#090d13', padding: '16px', borderRadius: '8px', border: '1px solid #30363d', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '13px', color: '#3fb950' }}>
                🖥️ 브라우저 실제 DOM (Native)
              </strong>
              <span key={`tag-${domFlashKey}`} className="reflow-warning-tag">
                🔥 FORCED REFLOW!
              </span>
            </div>
            <div
              key={`dom-${domFlashKey}`}
              ref={domTargetRef}
              className="flash-reflow"
              style={{
                width: `${containerWidth}px`,
                maxWidth: '100%',
                background: 'rgba(248, 81, 73, 0.05)',
                border: '1px solid rgba(248, 81, 73, 0.6)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '16px',
                lineHeight: `${LINE_HEIGHT}px`,
                wordBreak: 'break-word',
              }}
            >
              {text}
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#8b949e', textAlign: 'right' }}>
              offsetHeight 호출 비용: {domElapsedUs} µs (단일 프레임 블로킹)
            </div>
          </div>
        </div>
      </div>

      {/* 코드 설명 뷰어 (탭 지원) */}
      <CodeViewer
        title="2-Phase Engine 구현 및 라이브러리 내부 소스코드"
        snippets={[
          {
            tabLabel: '📱 컴포넌트 사용 코드',
            filePath: 'src/demos/BasicMeasureDemo.tsx',
            code: basicCodeSample,
            explanation: 'prepare()는 텍스트가 바뀔 때만 1회 호출하고, layout()은 슬라이더 조작 시 0.0002ms의 순수 산술 연산만 수행합니다.',
          },
          {
            tabLabel: '🔬 라이브러리 내부 핵심 코드 (@chenglou/pretext)',
            filePath: 'pretext/src/layout.ts & measurement.ts',
            code: libraryCodeSample,
            explanation: 'OffscreenCanvas를 써서 DOM Tree Invalidation을 피하고, 2단계 Map 캐싱과 단순 누적 숫자 덧셈(lineW += width)으로 극단적인 속도를 냅니다.',
          },
        ]}
      />
    </div>
  )
}
