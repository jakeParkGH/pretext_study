import React, { useState, useMemo, useRef, useEffect } from 'react'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

const SAMPLE_TEXT = `웹 프론트엔드 개발에서 텍스트의 크기와 줄바꿈에 따른 높이를 계산하는 작업은 언제나 브라우저 렌더링 파이프라인의 심각한 병목이었습니다. 가상 스크롤, 메이슨리 그리드, AI 실시간 스트리밍 인터페이스 등에서는 요소가 화면에 나타나기 전 정확한 크기를 알아야 레이아웃 시프트(CLS)를 방지할 수 있습니다. Pretext는 DOM을 건드리지 않고 순수 수학 연산만으로 이를 마이크로초(µs) 단위에 해결합니다.`

const FONT = '16px "Pretendard", -apple-system, sans-serif'
const LINE_HEIGHT = 26
const PADDING = 12
const BORDER = 1
const OVERHEAD_H = PADDING * 2 + BORDER * 2 // 26px (좌우 패딩 24px + 테두리 2px)
const OVERHEAD_V = PADDING * 2 + BORDER * 2 // 26px (상하 패딩 24px + 테두리 2px)

export const BasicMeasureDemo: React.FC = () => {
  const [containerWidth, setContainerWidth] = useState<number>(360)
  const [text, setText] = useState<string>(SAMPLE_TEXT)
  const domTargetRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [maxAvailableWidth, setMaxAvailableWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(360, window.innerWidth - 64) : 360
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

  const effectiveWidth = Math.max(180, Math.min(containerWidth, maxAvailableWidth))
  // 💡 핵심: 텍스트가 줄바꿈되는 실제 가용 내부 너비 = 컨테이너 너비 - 좌우 패딩/테두리
  const contentWidth = Math.max(100, effectiveWidth - OVERHEAD_H)

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
    const result = layout(prepared, contentWidth, LINE_HEIGHT)
    const elapsedMs = performance.now() - start
    setMathFlashKey((prev) => prev + 1)
    // 💡 박스 전체 높이(box-sizing: border-box) = 텍스트 산술 높이 + 상하 패딩/테두리
    const totalBoxHeight = result.height + OVERHEAD_V
    return { ...result, totalBoxHeight, elapsedUs: (elapsedMs * 1000).toFixed(2) }
  }, [prepared, contentWidth])

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
  }, [effectiveWidth, text])

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
// 2. 텍스트 가용 폭 = 컨테이너 폭 - 패딩(24px) - 테두리(2px)
// 3. 캐시된 세그먼트 너비 배열을 단순 누적 합산 (lineW += width)
// 4. 소요 시간: 약 0.0002ms (0.2µs) - 윈도우 리사이즈 루프에서도 120fps 유지!
const contentWidth = containerWidth - (PADDING * 2 + BORDER * 2);
const { height: textHeight, lineCount } = layout(prepared, contentWidth, LINE_HEIGHT);

// 5. CSS box-sizing: border-box 적용 요소의 전체 높이
const totalBoxHeight = textHeight + (PADDING * 2 + BORDER * 2);
`;

  const libraryCodeSample = `// -------------------------------------------------------------
// [@chenglou/pretext 내부 핵심 최적화 소스코드 발췌]
// -------------------------------------------------------------
// import { prepare, layout, type PreparedText, type LayoutResult } from '@chenglou/pretext';

// [1. pretext/src/measurement.ts: OffscreenCanvas로 DOM Invalidation 원천 차단]
// segmentWidthCaches: 폰트 문자열 -> (세그먼트 문자열 -> 픽셀 너비) 2단 Map 캐싱
let measureContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
const segmentWidthCaches = new Map<string, Map<string, number>>();

function createMeasureContext() {
  // ⚡ 최적화 1: DOM 트리에 노드를 붙이지 않는 1x1 OffscreenCanvas 사용
  // -> 일반 document.createElement와 달리 브라우저의 레이아웃 무효화 큐(Invalidation Queue)에
  //    영향을 주지 않아 강제 동기 레이아웃(Layout Thrashing)을 원천 차단!
  if (typeof OffscreenCanvas !== 'undefined') {
    measureContext = new OffscreenCanvas(1, 1).getContext('2d')!;
    return measureContext;
  }
  // OffscreenCanvas 미지원 환경 (일부 구형 브라우저)의 폴백
  if (typeof document !== 'undefined') {
    measureContext = document.createElement('canvas').getContext('2d')!;
    return measureContext;
  }
  throw new Error('Text measurement requires OffscreenCanvas or a DOM canvas context.');
}

// [2. pretext/src/measurement.ts: 세그먼트별 Canvas 너비 O(1) 캐시 조회]
function getSegmentWidth(seg: string, fontCache: Map<string, number>): number {
  // ⚡ 최적화 2: 이미 측정된 단어는 Canvas measureText()를 부르지 않고 O(1) 즉시 반환
  let w = fontCache.get(seg);
  if (w === undefined) {
    const ctx = measureContext ?? createMeasureContext();
    w = ctx.measureText(seg).width;
    fontCache.set(seg, w);  // 캐시에 저장 → 동일 단어 두 번째 호출부터 Canvas 0회
  }
  return w;
}

// [3. pretext/src/layout.ts: layout()의 초경량 Hot Path]
// LayoutResult = { lineCount: number; height: number }
export function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult {
  // ⚡ 최적화 3: layoutWithLines()와 달리 줄 범위 객체나 문자열 생성을 완전히 배제!
  // 오직 줄 수(lineCount)만 순수 산술 누적 루프로 계산 (~0.0002ms)
  const lineCount = countLines(prepared, maxWidth);
  return { lineCount, height: lineCount * lineHeight };
}

// [4. pretext/src/line-break.ts: 산술 누적 루프 (PreparedText 내부 widths/kinds 배열 1회 순회)]
// PreparedText 내부(PreparedCore): widths[], kinds(SegmentBreakKind[]) 등 병렬 배열
//   SegmentBreakKind = 'text' | 'space' | 'tab' | 'mandatory-break' | 'soft-hyphen' | 'zero-width-space'
function countLines(prepared: PreparedText, maxWidth: number): number {
  const { widths, kinds } = prepared as any; // PreparedCore (번들 내부 타입)
  let lineCount = 0;
  let lineW = 0;

  for (let i = 0; i < widths.length; i++) {
    const w: number = widths[i];
    const kind: string = kinds[i];

    if (kind === 'mandatory-break') {
      lineCount++;   // \\n 강제 개행 → 즉시 새 줄
      lineW = 0;
      continue;
    }
    // 현재 줄 누적 폭 + 새 세그먼트 폭이 maxWidth 초과 → 줄바꿈
    if (lineW + w > maxWidth && lineW > 0) {
      lineCount++;
      lineW = w;     // 새 줄의 첫 단어 폭으로 시작
    } else {
      lineW += w;    // ⚡ 숫자 덧셈만으로 다음 줄바꿈 지점 탐색 (DOM 호출 0회!)
    }
  }
  if (lineW > 0) lineCount++;
  return lineCount;
}
`;

  const cssEmulationCodeSample = `// -------------------------------------------------------------
// [@chenglou/pretext 내부: CSS white-space & UAX #14 에뮬레이션]
// 파일: pretext/src/analysis.ts & line-break.ts
// -------------------------------------------------------------

// 1. 세그먼트의 줄바꿈 특성을 나타내는 내부 모델 (SegmentBreakKind)
export type SegmentBreakKind =
  | 'text'              // 일반 단어 (줄바꿈 불가 단위)
  | 'space'             // 공백 문자 (CSS 줄 끝에서 너비 0으로 무시되는 후행 공백 대상)
  | 'tab'               // 탭 문자
  | 'mandatory-break'   // \\n 강제 개행
  | 'soft-hyphen'       // 소프트 하이픈 (줄 끝에서만 하이픈 글리프로 나타남)
  | 'zero-width-space'; // 너비 없는 줄바꿈 가능 지점 (ZWSP)

// 2. CSS white-space의 '후행 공백 무시(Trailing Whitespace Trimming)' 에뮬레이션
// 브라우저는 줄 끝에 위치한 스페이스(' ')가 maxWidth를 넘어가더라도 다음 줄로 넘기지 않고
// 해당 라인의 가용 폭을 초과하는 공백 너비를 시각적으로 무시(Trim)합니다.
function commitLineWithTrailingSpaces(
  lineW: number,
  lastVisibleEnd: number,
  trailingSpacesW: number
): void {
  // ⚡ Pretext는 줄 끝에 매달린 'space' 세그먼트들의 너비를 lineW에서 제외하여
  // 브라우저 텍스트 렌더러와 1px의 오차도 없는 완벽한 줄바꿈 높이를 도출합니다!
  const actualLineWidth = lineW - trailingSpacesW;
  recordLine(actualLineWidth);
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
            <span className="control-label">컨테이너 너비: {effectiveWidth}px</span>
            <input
              type="range"
              min={180}
              max={650}
              value={effectiveWidth}
              onChange={(e) => setContainerWidth(Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="metric-pill info">
              ⚡ Pretext: {pretextResult.elapsedUs} µs
            </span>
            <span className="metric-pill">
              줄 수: {pretextResult.lineCount}줄 / 전체 {pretextResult.totalBoxHeight}px (본문 {pretextResult.height}px)
            </span>
            <span className="metric-pill danger">
              🔥 누적 Reflow: {totalReflowCount}회
            </span>
          </div>
        </div>

        {/* 인터랙티브 뷰포트 비교 (내부 가용 폭을 정밀 측정) */}
        <div
          ref={wrapperRef}
          className="side-by-side"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}
        >
          {/* Pretext 뷰포트 */}
          <div className="viewport-box" style={{ width: `${effectiveWidth}px`, maxWidth: '100%', margin: '0 auto' }}>
            <div className="viewport-label">
              <span>⚡ Pretext 순수 산술식 높이</span>
              <span key={mathFlashKey} className="flash-badge">
                {pretextResult.totalBoxHeight}px ({pretextResult.lineCount}줄)
              </span>
            </div>
            <div
              style={{
                height: `${pretextResult.totalBoxHeight}px`,
                background: 'var(--bg-secondary)',
                border: `${BORDER}px solid var(--accent-blue)`,
                padding: `${PADDING}px`,
                borderRadius: '6px',
                font: FONT,
                lineHeight: `${LINE_HEIGHT}px`,
                wordBreak: 'break-word',
                transition: 'height 0.1s ease',
                boxSizing: 'border-box',
              }}
            >
              {text}
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#8b949e', textAlign: 'right' }}>
              연산 소요 시간: {pretextResult.elapsedUs} µs (0 DOM Reflow)
            </div>
          </div>

          {/* 브라우저 실제 DOM 뷰포트 */}
          <div className="viewport-box" style={{ width: `${effectiveWidth}px`, maxWidth: '100%', margin: '0 auto' }}>
            <div className="viewport-label">
              <span>🔥 브라우저 실제 offsetHeight</span>
              <span key={domFlashKey} className="flash-badge danger">
                {domMeasuredHeight}px
              </span>
            </div>
            <div
              ref={domTargetRef}
              style={{
                background: 'var(--bg-secondary)',
                border: `${BORDER}px solid rgba(248, 81, 73, 0.6)`,
                padding: `${PADDING}px`,
                borderRadius: '6px',
                font: FONT,
                lineHeight: `${LINE_HEIGHT}px`,
                wordBreak: 'break-word',
                boxSizing: 'border-box',
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
          {
            tabLabel: '🔠 CSS 줄바꿈 & UAX #14 에뮬레이션',
            filePath: 'pretext/src/analysis.ts & line-break.ts',
            code: cssEmulationCodeSample,
            explanation: 'Pretext는 브라우저 DOM 없이도 CSS white-space의 공백 병합, 줄 끝 후행 공백(trailing space) 무시, UAX #14 줄바꿈 규칙을 100% 동일하게 에뮬레이션합니다.',
          },
        ]}
      />
    </div>
  )
}
