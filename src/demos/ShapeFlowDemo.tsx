import React, { useState, useMemo } from 'react'
import {
  prepareWithSegments,
  layoutNextLine,
  materializeLineRange,
  type LayoutCursor,
  type LayoutLine,
} from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

const ARTICLE_TEXT = `인공지능의 시대에는 실시간 인터랙션과 고밀도 정보의 유려한 시각화가 사용자 경험의 핵심 경쟁력이 됩니다. 그러나 기존 브라우저 CSS의 shape-outside나 float 속성은 매우 제한적이며 반응형 인터랙션이나 실시간 드래그 시 60fps를 유지하기 어렵습니다. Pretext의 커서 기반 layoutNextLine() API를 사용하면, 원형이나 다각형 등 어떤 형태의 장애물이라도 라인별 허용 너비를 동적으로 계산하여 마치 잡지나 에디토리얼 레이아웃처럼 텍스트가 물 흐르듯 감싸게(Wrap) 만들 수 있습니다. 매 줄마다 새로운 너비를 전달할 수 있고, 텍스트 커서는 직전 줄의 끝 지점에서 그대로 이어지므로 텍스트 연속성이 완벽하게 보장됩니다.`

const FONT = '15px "Pretendard", -apple-system, sans-serif'
const LINE_HEIGHT = 26
const CONTAINER_WIDTH = 580

export const ShapeFlowDemo: React.FC = () => {
  // 장애물(원형 프로필/배지) 위치 및 반경
  const [obstacleX, setObstacleX] = useState<number>(380)
  const [obstacleY, setObstacleY] = useState<number>(100)
  const [obstacleRadius, setObstacleRadius] = useState<number>(55)

  // 1회성 전처리: prepareWithSegments (라인별 커서 탐색을 위해 필요)
  const prepared = useMemo(() => {
    return prepareWithSegments(ARTICLE_TEXT, FONT)
  }, [])

  // ============================================================================
  // [Pretext 장애물 회피 라인 바이 라인 레이아웃 (dynamic-layout.ts 인용)]
  // ============================================================================
  const lines = useMemo(() => {
    const resultLines: Array<{ line: LayoutLine; y: number; x: number }> = []
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let currentY = 10
    const maxY = 450 // 최대 높이 제한

    while (currentY < maxY) {
      // 1. 현재 라인 밴드 [currentY, currentY + LINE_HEIGHT]가 장애물과 겹치는지 계산
      const lineCenterY = currentY + LINE_HEIGHT / 2
      const dy = Math.abs(lineCenterY - obstacleY)

      let allowedWidth = CONTAINER_WIDTH - 20
      let startX = 10

      // 원형 장애물과의 수평 침범 거리 계산 (피타고라스 정리)
      if (dy < obstacleRadius + 10) {
        const dx = Math.sqrt(Math.max(0, Math.pow(obstacleRadius + 14, 2) - Math.pow(dy, 2)))
        const obstacleLeft = obstacleX - dx
        const obstacleRight = obstacleX + dx

        // 장애물이 오른쪽에 위치할 경우 텍스트 너비를 줄여서 배치
        if (obstacleLeft > startX && obstacleLeft < CONTAINER_WIDTH) {
          allowedWidth = Math.max(80, obstacleLeft - startX)
        }
      }

      // 2. ⚡ Pretext의 반복자 API: layoutNextLine()
      // 현재 cursor 위치에서 allowedWidth만큼 한 줄을 산술 연산으로 도출!
      const line = layoutNextLine(prepared, cursor, allowedWidth)
      if (!line) break // 텍스트를 모두 소비했으면 종료

      resultLines.push({ line, y: currentY, x: startX })

      // 3. 커서를 다음 줄 시작 위치로 갱신 (line.end ➔ 다음 줄의 cursor)
      cursor = line.end
      currentY += LINE_HEIGHT
    }

    return resultLines
  }, [prepared, obstacleX, obstacleY, obstacleRadius])

  const shapeFlowCode = `// ------------------------------------------------------------------
// [자유 형태 장애물 텍스트 래핑: pages/demos/dynamic-layout.ts]
// ------------------------------------------------------------------
import { prepareWithSegments, layoutNextLine, type LayoutCursor } from '@chenglou/pretext';

const prepared = prepareWithSegments(articleText, FONT);
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
let y = 0;

// 각 줄마다 장애물 위치에 맞춰 동적으로 계산된 너비로 텍스트를 흘려보냄
while (true) {
  // 1. 현재 줄(y)이 원형 장애물과 겹치는지 기하학적 너비 계산
  const availableWidth = calculateAvailableWidthAtY(y, obstacle);

  // 2. ⚡ 해당 너비에 맞는 다음 줄 텍스트를 커서 기반으로 도출 (순수 산술 연산)
  const line = layoutNextLine(prepared, cursor, availableWidth);
  if (!line) break; // 텍스트 소진 시 종료

  // 3. 캔버스나 화면에 출력하고 커서를 다음 줄로 이동
  renderLine(line.text, 0, y);
  cursor = line.end; // 직전 줄의 끝 커서가 다음 줄의 시작 커서가 됨!
  y += LINE_HEIGHT;
}
`;

  const shapeFlowLibraryCodeSample = `// ------------------------------------------------------------------
// [@chenglou/pretext 내부 핵심 코드: layoutNextLine() & 커서 기반 탐색]
// 파일: pretext/src/layout.ts (Line 933-965)
// ------------------------------------------------------------------
export function layoutNextLine(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): LayoutLine | null {
  // ⚡ 최적화 1: 텍스트의 처음부터 다시 탐색하지 않고, 직전 라인의 end 커서부터 점진적(Incremental) 탐색!
  const range = layoutNextLineRange(prepared, start, maxWidth);
  if (range === null) return null;

  // ⚡ 최적화 2: 줄바꿈 판정 중에는 문자열을 만들지 않고, 
  // 화면 출력이 확정된 최종 라인에 대해서만 1회 문자열을 슬라이스(materialize)
  return materializeLineRange(prepared, range);
}

export function layoutNextLineRange(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): LayoutLineRange | null {
  const line = createLayoutLineRange(0, 0, 0, 0, 0);
  const cursor: LineBreakCursor = {
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex,
  };

  // chunkIndex를 찾고 해당 청크 내에서만 maxWidth에 맞춰 한 줄 연산 진행
  const chunkIndex = normalizePreparedLineStart(prepared, cursor);
  // ... 산술 연산으로 단 1줄의 너비와 커서 범위 도출
  return line;
}

// 💡 왜 장애물 회피(Shape Flow)에 이 코드가 결정적인가?
// - CSS shape-outside는 브라우저 내부 레이아웃 트리를 전면 재계산하여 리사이즈 시 버벅임이 심함.
// - layoutNextLine()은 커서(cursor: { segmentIndex, graphemeIndex })만 이동하며
//   줄마다 임의의 maxWidth를 넘겨줄 수 있으므로 어떤 복잡한 형상도 60fps로 실시간 래핑이 가능함!
`;

  return (
    <div className="demo-wrapper">
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>🌊 자유 형태 텍스트 래핑 (Shape Flow / Obstacle Wrapping)</span>
          </div>
          <div className="demo-card-desc">
            `layoutNextLine()` 커서 기반 API를 통해, 실시간으로 장애물(원형 배지)의 좌표를 피해 텍스트가 유려하게 흘러가도록 배치합니다.
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <span className="control-label">장애물 X 위치: {obstacleX}px</span>
            <input
              type="range"
              min={250}
              max={480}
              value={obstacleX}
              onChange={(e) => setObstacleX(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <span className="control-label">장애물 Y 위치: {obstacleY}px</span>
            <input
              type="range"
              min={50}
              max={220}
              value={obstacleY}
              onChange={(e) => setObstacleY(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <span className="control-label">장애물 크기: {obstacleRadius}px</span>
            <input
              type="range"
              min={35}
              max={75}
              value={obstacleRadius}
              onChange={(e) => setObstacleRadius(Number(e.target.value))}
            />
          </div>
        </div>

        {/* 인터랙티브 래핑 뷰포트 */}
        <div
          style={{
            position: 'relative',
            width: `${CONTAINER_WIDTH}px`,
            maxWidth: '100%',
            height: '380px',
            background: '#090d13',
            border: '1px solid #30363d',
            borderRadius: '10px',
            margin: '0 auto',
            overflow: 'hidden',
          }}
        >
          {/* 장애물 요소 */}
          <div
            style={{
              position: 'absolute',
              left: `${obstacleX - obstacleRadius}px`,
              top: `${obstacleY - obstacleRadius}px`,
              width: `${obstacleRadius * 2}px`,
              height: `${obstacleRadius * 2}px`,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #58a6ff, #1f6feb)',
              boxShadow: '0 0 24px rgba(88, 166, 255, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '13px',
              zIndex: 10,
              cursor: 'move',
              userSelect: 'none',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <span>OBSTACLE</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>({obstacleX}, {obstacleY})</span>
          </div>

          {/* 라인별 텍스트 출력 */}
          {lines.map((item, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${item.line.width}px`,
                height: `${LINE_HEIGHT}px`,
                lineHeight: `${LINE_HEIGHT}px`,
                fontSize: '15px',
                color: '#e6edf3',
                whiteSpace: 'nowrap',
              }}
            >
              {item.line.text}
            </div>
          ))}
        </div>
      </div>

      {/* 소스 코드 뷰어 (탭 지원) */}
      <CodeViewer
        title="layoutNextLine() 커서 라우팅 및 라이브러리 내부 소스코드"
        snippets={[
          {
            tabLabel: '📱 컴포넌트 래핑 코드',
            filePath: 'src/demos/ShapeFlowDemo.tsx',
            code: shapeFlowCode,
            explanation: 'layoutNextLine()을 사용해 줄마다 다른 허용 너비를 전달하고, cursor.end를 다음 줄의 시작으로 넘겨 연속성을 보장합니다.',
          },
          {
            tabLabel: '🔬 라이브러리 내부 핵심 코드 (@chenglou/pretext)',
            filePath: 'pretext/src/layout.ts (layoutNextLine)',
            code: shapeFlowLibraryCodeSample,
            explanation: 'layoutNextLine()은 텍스트 처음부터 다시 파싱하지 않고 직전 줄의 end 커서에서 즉각 다음 줄을 계산하여 O(1) 수준으로 빠르게 라우팅합니다.',
          },
        ]}
      />
    </div>
  )
}
