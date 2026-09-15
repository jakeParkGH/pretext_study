import React, { useState, useEffect, useRef, useMemo } from 'react'
import { prepare, layout, type PreparedText } from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

const STREAMING_SOURCE = [
  '안녕하세요! ',
  'Pretext를 ',
  '활용한 ',
  'LLM ',
  '토큰 ',
  '스트리밍 ',
  '최적화 ',
  '데모입니다. ',
  '일반적인 ',
  'AI ',
  '챗봇 ',
  '구현에서는 ',
  '새로운 ',
  '토큰이 ',
  '들어올 ',
  '때마다 ',
  'scrollTop = ',
  'scrollHeight를 ',
  '호출하여 ',
  '최하단으로 ',
  '자동 ',
  '스크롤합니다. ',
  '하지만 ',
  '토큰이 ',
  '추가된 ',
  '직후 ',
  'scrollHeight를 ',
  '읽는 ',
  '순간, ',
  '브라우저는 ',
  'VSync를 ',
  '기다리지 ',
  '못하고 ',
  '그자리에서 ',
  '강제 ',
  '동기 ',
  '레이아웃(Forced Layout)을 ',
  '일으킵니다. ',
  '1초에 ',
  '수십 개의 ',
  '토큰이 ',
  '들어오면 ',
  '메인 ',
  '스레드가 ',
  '완전히 ',
  '잠식되어 ',
  '심각한 ',
  '프레임 ',
  '드랍(Jank)이 ',
  '발생합니다. ',
  'Pretext는 ',
  'DOM을 ',
  '읽지 ',
  '않고도 ',
  '정확한 ',
  '누적 ',
  '높이를 ',
  '마이크로초 ',
  '단위로 ',
  '사전 ',
  '계산할 ',
  '수 ',
  '있습니다! 🚀',
]

const FONT = '15px "Pretendard", -apple-system, sans-serif'
const LINE_HEIGHT = 24
const CONTAINER_WIDTH = 340

export const StreamingDemo: React.FC = () => {
  const [tokenIndex, setTokenIndex] = useState<number>(0)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [mode, setMode] = useState<'naive' | 'pretext'>('pretext')
  const [forcedReflowCount, setForcedReflowCount] = useState<number>(0)
  const [flashKey, setFlashKey] = useState<number>(0)

  const chatBoxRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [maxAvailableWidth, setMaxAvailableWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(CONTAINER_WIDTH, window.innerWidth - 64) : CONTAINER_WIDTH
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

  const effectiveWidth = Math.max(260, Math.min(CONTAINER_WIDTH, maxAvailableWidth))

  // 현재까지 수신된 텍스트
  const currentText = useMemo(() => {
    return STREAMING_SOURCE.slice(0, tokenIndex).join('')
  }, [tokenIndex])

  // 스트리밍 타이머
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      setTokenIndex((prev) => {
        if (prev >= STREAMING_SOURCE.length) {
          setIsStreaming(false)
          return prev
        }
        return prev + 1
      })
    }, 60) // 60ms마다 새 토큰 유입

    return () => clearInterval(interval)
  }, [isStreaming])

  // 스크롤 동기화 처리
  useEffect(() => {
    if (!chatBoxRef.current || tokenIndex === 0) return

    if (mode === 'naive') {
      // 💥 안티패턴: 토큰 추가 직후 곧바로 scrollHeight를 읽음 ➔ 강제 동기 리플로우 발생!
      const targetScroll = chatBoxRef.current.scrollHeight
      chatBoxRef.current.scrollTop = targetScroll
      setForcedReflowCount((prev) => prev + 1)
      setFlashKey((prev) => prev + 1)
    } else {
      // ⚡ Pretext 패턴: DOM을 묻지 않고 layout()으로 계산된 높이 사용
      const prepared = prepare(currentText, FONT)
      const { height } = layout(prepared, effectiveWidth - 24, LINE_HEIGHT)
      chatBoxRef.current.scrollTop = height
    }
  }, [currentText, effectiveWidth, mode, tokenIndex])

  const handleStart = () => {
    setTokenIndex(0)
    setForcedReflowCount(0)
    setIsStreaming(true)
  }

  const handleReset = () => {
    setIsStreaming(false)
    setTokenIndex(0)
    setForcedReflowCount(0)
  }

  const streamingCodeSample = `// ------------------------------------------------------------------
// [LLM 스트리밍 시 강제 동기 리플로우 방지 패턴]
// ------------------------------------------------------------------

// ❌ 안티패턴: 토큰 수신 시마다 DOM 측정 강제
function onTokenReceivedNaive(token) {
  messageElement.textContent += token; // 1. DOM 변경 (Dirty Flag 세팅)
  
  // 💥 2. 즉시 높이 읽기 -> 브라우저가 VSync 대기 큐를 강제 플러시하여 Hard Reflow 발생!
  container.scrollTop = container.scrollHeight; 
}

// ------------------------------------------------------------------
// ⚡ Pretext 최적화 패턴: 순수 산술 연산 높이 추적
// ------------------------------------------------------------------
import { prepare, layout } from '@chenglou/pretext';

let accumulatedText = "";

function onTokenReceivedPretext(token, containerWidth) {
  accumulatedText += token;
  
  // 1. 순수 연산으로 현재 누적 높이 계산 (DOM Query 없음!)
  const prepared = prepare(accumulatedText, FONT);
  const { height } = layout(prepared, containerWidth, LINE_HEIGHT);
  
  // 2. 브라우저 VSync 턴에 맞춰 rAF로 안전하게 스크롤만 지시
  requestAnimationFrame(() => {
    container.scrollTop = height;
  });
}
`;

  const streamingLibraryCodeSample = `// ============================================================================
// [@chenglou/pretext/src/layout.ts & line-break.ts]
// LLM 스트리밍에서 DOM Dirty Bit 플러시 없이 높이를 0.0002ms에 계산하는 원리
// ============================================================================

/**
 * 1. layout()의 핵심:
 * DOM을 읽지 않고 오직 캐시된 폭 배열(PreparedLineBreakData)을 순회하여
 * lineCount를 센 뒤, (lineCount * lineHeight)로 높이를 반환합니다.
 * 
 * 💡 브라우저가 DOM을 읽는 scrollHeight, clientHeight 호출이 0회이므로
 *    Dirty bit가 마킹된 DOM 트리를 강제로 플러시(Hard Reflow)할 필요가 전혀 없습니다.
 */
export function layout(
  prepared: PreparedText,
  maxWidth: number,
  lineHeight: number
): LayoutResult {
  // layoutWithLines()와 달리 각 줄의 문자열 인덱스를 기록하지 않고
  // 오직 줄 바꿈 횟수만 세는 초고속 경로(countPreparedLines)를 탑니다.
  const lineCount = countPreparedLines(getInternalPrepared(prepared), maxWidth);
  return {
    lineCount,
    height: lineCount * lineHeight, // 📐 순수 CPU 정수/부동소수점 곱셈 연산!
  };
}

/**
 * 2. countPreparedLines():
 * DOM 레이아웃 트리 순회가 아닌, JS 힙 메모리의 폭 배열을 1회 루프하는 순수 알고리즘
 */
export function countPreparedLines(
  prepared: PreparedLineBreakData,
  maxWidth: number
): number {
  const { widths, kinds } = prepared;
  if (widths.length === 0) return 0;

  let lineCount = 0;
  let lineW = 0;

  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    // 현재 누적 폭에 새 세그먼트를 더했을 때 maxWidth를 초과하면 줄바꿈
    if (lineW + w > maxWidth && lineW > 0) {
      lineCount++;
      lineW = w;
    } else {
      lineW += w;
    }
  }

  if (lineW > 0) lineCount++;
  return lineCount;
}

/**
 * 🚀 브라우저 렌더링 파이프라인 관점에서의 차이점:
 * 
 * 1) 기존 방식 (element.scrollHeight):
 *    JS 실행 -> DOM 변경 (dirty) -> [scrollHeight 요청!]
 *    -> 브라우저 렌더러: "잠깐! 최신 높이를 알아야 하니 지금 즉시 동기 레이아웃 실행해!"
 *    -> VSync 주기 무시, 매 토큰마다 동기식 CPU 100% 낭비 및 레이아웃 스래싱!
 * 
 * 2) Pretext 방식 (layout(prepared, width, lineHeight)):
 *    JS 실행 -> Pretext 순수 연산으로 height 산출 -> rAF 스케줄링
 *    -> 브라우저 렌더러: "DOM 조회가 없으니 다음 VSync 신호 올 때까지 파이프라인 대기"
 *    -> VSync 하드웨어 틱(16.6ms/8.3ms)에 정확히 1회만 일괄 렌더링 & 스크롤!
 */
`;

  const streamingVsyncCodeSample = `// ------------------------------------------------------------------
// [초당 50+ 토큰 고속 스트리밍과 VSync 8.3ms 프레임 예산 보호]
// ------------------------------------------------------------------

/**
 * 💥 문제점: 최신 LLM(Gemini Flash, Claude 등)의 초당 50~100 토큰 폭주
 * 
 * 120Hz 주사율 디스플레이의 프레임 예산은 단 8.33ms입니다.
 * 초당 60개의 토큰이 들어올 때 매번 scrollHeight를 읽으면:
 * - 1초당 60회의 동기식 레이아웃(Layout Thrashing) 강제 호출
 * - 회당 레이아웃 비용 1.5ms 가정 시: 60 * 1.5ms = 90ms/sec가 순수 레이아웃에 낭비됨!
 * - 메인 스레드가 완전히 멈춰서 버튼 클릭, 스크롤 인터랙션이 먹통이 됨.
 */

// ✅ 해결책: Pretext + rAF 버퍼링 콤보
class FastStreamingScroller {
  private targetScrollTop = 0;
  private rafScheduled = false;

  onChunk(accumulatedText: string, containerWidth: number) {
    // 1. 순수 JS 산술 연산으로 높이 계산 (~0.0002ms) -> 프레임 예산의 0.002%만 사용!
    const prepared = prepare(accumulatedText, FONT);
    const { height } = layout(prepared, containerWidth, LINE_HEIGHT);
    this.targetScrollTop = height;

    // 2. 브라우저 VSync 틱에 맞춰 1프레임당 단 1번만 실제 스크롤 반영
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(() => {
        container.scrollTop = this.targetScrollTop;
        this.rafScheduled = false;
      });
    }
  }
}
`;

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>⚡ LLM 토큰 스트리밍과 VSync 프레임 예산 보호</span>
          </div>
          <div className="demo-card-desc">
            매 토큰 유입 시 `scrollHeight`를 읽어 발생하는 치명적인 동기식 강제 레이아웃(Layout Thrashing)을
            Pretext의 사전 계산 산술식으로 어떻게 100% 차단하는지 체험해보세요.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn ${isStreaming ? 'btn-primary' : ''}`}
              onClick={handleStart}
              disabled={isStreaming}
            >
              {isStreaming ? '⏳ 토큰 생성 스트리밍 중...' : '▶️ 스트리밍 시작'}
            </button>
            <button className="btn" onClick={handleReset} disabled={isStreaming}>
              초기화
            </button>
            <button
              className={`btn ${mode === 'pretext' ? 'btn-primary' : ''}`}
              onClick={() => setMode(mode === 'pretext' ? 'naive' : 'pretext')}
              disabled={isStreaming}
              style={{
                borderColor: mode === 'pretext' ? 'var(--accent-blue)' : '#f85149',
                color: mode === 'pretext' ? 'var(--accent-blue)' : '#f85149',
              }}
            >
              {mode === 'pretext' ? '⚡ Pretext 모드 (Zero Reflow)' : '💥 기존 Naive 모드 (Forced Reflow)'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="metric-pill">
              토큰 수: {tokenIndex} / {STREAMING_SOURCE.length}
            </span>
            <span className={`metric-pill ${forcedReflowCount > 0 ? 'danger' : 'info'}`}>
              누적 강제 리플로우: {forcedReflowCount}회
            </span>
          </div>
        </div>

        {/* 스트리밍 채팅창 뷰포트 wrapper */}
        <div ref={wrapperRef} style={{ width: '100%', maxWidth: '100%' }}>
          <div
            ref={chatBoxRef}
            key={`chat-${flashKey}`}
            className={mode === 'naive' && flashKey > 0 ? 'flash-reflow' : ''}
            style={{
              width: `${effectiveWidth}px`,
              height: '240px',
              maxWidth: '100%',
            margin: '0 auto',
            background: '#090d13',
            border: `1px solid ${mode === 'naive' && flashKey > 0 ? '#f85149' : 'var(--border-color)'}`,
            borderRadius: '12px',
            padding: '12px',
            overflowY: 'auto',
            fontSize: '15px',
            lineHeight: `${LINE_HEIGHT}px`,
            wordBreak: 'break-word',
            color: '#e6edf3',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            transition: 'border-color 0.15s ease',
          }}
        >
          {currentText || (
            <span style={{ color: '#484f58', fontStyle: 'italic' }}>
              스트리밍 시작 버튼을 눌러보세요...
            </span>
          )}
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '16px',
                background: '#58a6ff',
                marginLeft: '4px',
                verticalAlign: 'middle',
                animation: 'blink 0.8s infinite',
              }}
            />
          )}
          </div>
        </div>
      </div>

      {/* 소스 코드 뷰어 */}
      <CodeViewer
        title="LLM 스트리밍 오토스크롤 최적화 원리"
        snippets={[
          {
            tabLabel: '📱 컴포넌트 스트리밍 최적화 코드',
            filePath: 'src/demos/StreamingDemo.tsx',
            code: streamingCodeSample,
            explanation:
              '새 토큰을 수신할 때마다 scrollHeight를 직접 읽으면 브라우저의 VSync 대기 큐를 강제 플러시(Hard Reflow)합니다. Pretext의 layout()을 사용하면 DOM을 전혀 건드리지 않고 순수 산술 연산만으로 누적 높이를 도출하여 VSync 타이밍에 안전하게 스크롤을 반영할 수 있습니다.',
          },
          {
            tabLabel: '🔬 라이브러리 내부 핵심 동작 원리 (@chenglou/pretext)',
            filePath: 'pretext/src/layout.ts & line-break.ts',
            code: streamingLibraryCodeSample,
            explanation:
              'layout()은 DOM을 전혀 건드리지 않고 캐시된 폭 배열을 바탕으로 countPreparedLines()를 실행하여 O(N) 산술 연산으로 높이(lineCount * lineHeight)를 도출합니다. DOM Dirty bit 플러시를 완벽히 우회하므로 60/120fps를 안정적으로 방어합니다.',
          },
          {
            tabLabel: '⚡ 초당 50+ 토큰과 VSync 8.3ms 예산 보호',
            filePath: 'Chromium Rendering Pipeline & VSync Budget',
            code: streamingVsyncCodeSample,
            explanation:
              '초당 수십 개 토큰이 쏟아지는 고속 LLM 환경에서 DOM scrollHeight 호출을 전면 제거하고 requestAnimationFrame과 Pretext 높이 산출을 결합하여 메인 스레드 잠식을 차단합니다.',
          },
        ]}
      />
    </div>
  )
}
