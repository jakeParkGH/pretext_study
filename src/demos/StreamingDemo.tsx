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
  '리플로우(Hard Reflow)를 ',
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
      const { height } = layout(prepared, CONTAINER_WIDTH - 24, LINE_HEIGHT)
      chatBoxRef.current.scrollTop = height
    }
  }, [currentText, mode, tokenIndex])

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

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>⚡ LLM 실시간 토큰 스트리밍과 VSync 보호</span>
          </div>
          <div className="demo-card-desc">
            AI 응답이 실시간 스트리밍될 때 발생하는 레이아웃 스래싱(Layout Thrashing)을 방지하고 부드러운 스크롤을 유지하는 방법을 시뮬레이션합니다.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={isStreaming}
            >
              {isStreaming ? '스트리밍 중...' : '▶ 스트리밍 시작'}
            </button>
            <button className="btn" onClick={handleReset}>
              초기화
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">모드 선택:</span>
            <button
              className={`btn ${mode === 'naive' ? 'btn-primary' : ''}`}
              onClick={() => setMode('naive')}
            >
              ❌ 기존 (강제 Reflow)
            </button>
            <button
              className={`btn ${mode === 'pretext' ? 'btn-primary' : ''}`}
              onClick={() => setMode('pretext')}
            >
              ⚡ Pretext 예측
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode === 'naive' && isStreaming && (
              <span key={`alert-${flashKey}`} className="reflow-warning-tag">
                ⚠️ HARD REFLOW!
              </span>
            )}
            {mode === 'pretext' && (
              <span className="pure-math-tag">
                🛡️ VSync Safe (0 Reflow)
              </span>
            )}
            <span
              className={`metric-pill ${mode === 'naive' && forcedReflowCount > 0 ? 'danger' : 'info'}`}
            >
              {mode === 'naive'
                ? `강제 동기 리플로우 발생: ${forcedReflowCount}회`
                : 'Zero DOM 리플로우 (Pretext 순수 연산)'}
            </span>
          </div>
        </div>

        {/* 스트리밍 뷰포트 (스크롤바 숨김 처리 및 안티패턴 시 경고 플래시) */}
        <div
          key={mode === 'naive' ? `naive-box-${flashKey}` : 'pretext-box'}
          ref={chatBoxRef}
          className={`streaming-viewport hide-scrollbar ${mode === 'naive' && isStreaming ? 'flash-reflow' : ''}`}
          style={{
            width: `${CONTAINER_WIDTH}px`,
            maxWidth: '100%',
            height: '240px',
            background: '#090d13',
            border: `2px solid ${mode === 'naive' ? '#f85149' : '#58a6ff'}`,
            borderRadius: '10px',
            padding: '16px',
            margin: '0 auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            fontSize: '15px',
            lineHeight: `${LINE_HEIGHT}px`,
            color: '#f0f6fc',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            boxShadow:
              mode === 'naive'
                ? '0 0 20px rgba(248, 81, 73, 0.3)'
                : '0 0 16px rgba(88, 166, 255, 0.15)',
            transition: 'border-color 0.2s',
          }}
        >
          {currentText || (
            <span style={{ color: '#8b949e' }}>
              '스트리밍 시작' 버튼을 눌러 시뮬레이션을 실행하세요.
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
        ]}
      />
    </div>
  )
}
