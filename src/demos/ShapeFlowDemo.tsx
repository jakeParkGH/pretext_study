import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
} from '@chenglou/pretext'
import { CodeViewer } from '../components/CodeViewer'

const ARTICLE_TEXT = `인공지능과 차세대 웹 플랫폼의 시대에는 실시간 인터랙션과 고밀도 정보의 유려한 시각화가 사용자 경험의 핵심 경쟁력이 됩니다. 그러나 기존 브라우저 CSS의 shape-outside나 float 속성은 매우 치명적인 한계가 있습니다. CSS float는 구조상 요소의 한쪽 면(오른쪽 또는 왼쪽)으로만 텍스트를 흘려보낼 수 있으며, 장애물 양쪽으로 텍스트를 동시에 채우는 양방향 래핑(Dual-Slot Wrapping)이 불가능합니다. 또한 사용자가 요소를 실시간으로 드래그하거나 위치가 바뀔 때마다 브라우저 내부 레이아웃 트리가 전면 무효화되어 심각한 프레임 드랍(Layout Thrashing)이 발생합니다.

반면 Pretext의 커서 기반 layoutNextLine() API와 기하학 슬롯 분할(Slot Carving) 알고리즘을 결합하면, 원형이나 다각형 등 어떤 복잡한 형상의 장애물이라도 라인별 사용 가능 슬롯(Interval)을 수식으로 도출하여 텍스트를 물 흐르듯 양쪽 모두에 완벽하게 채울 수 있습니다. 각 텍스트 라인 밴드마다 장애물이 가로막고 있는 수평 구간을 계산하여 좌측 슬롯과 우측 슬롯으로 쪼갠 뒤, 직전 슬롯에서 끝난 커서(cursor.end)를 다음 슬롯의 시작점으로 넘겨주는 것만으로 글의 흐름이 한 줄기 강물처럼 이어집니다.

DOM 측정이나 스타일 재계산이 전혀 개입하지 않는 순수 산술 연산이므로, 장애물 오브젝트를 마우스나 터치로 아무리 빠르게 드래그해도 항상 매끄러운 60fps로 실시간 리플로우(Reflow)를 유지합니다. 이것이 바로 잡지나 전문 에디토리얼 인쇄물에서나 볼 수 있었던 인터랙티브 셰이프 레이아웃을 웹에서 지연 없이 구현하는 Pretext만의 혁신적인 접근법입니다.`

const FONT = '15px "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const LINE_HEIGHT = 26
const CONTAINER_WIDTH = 580
const CONTAINER_HEIGHT = 418

interface Interval {
  left: number
  right: number
}

/**
 * 특정 텍스트 라인 밴드 [bandTop, bandBottom]에서 원형 장애물이 차지하는 수평 침범 구간을 계산합니다.
 * (공식 pretext pages/demos/wrap-geometry.ts circleIntervalForBand 동일 알고리즘)
 */
function circleIntervalForBand(
  cx: number,
  cy: number,
  r: number,
  bandTop: number,
  bandBottom: number,
  hPad: number = 14,
  vPad: number = 4,
): Interval | null {
  const top = bandTop - vPad
  const bottom = bandBottom + vPad
  if (top >= cy + r || bottom <= cy - r) return null
  const minDy = cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom
  if (minDy >= r) return null
  const maxDx = Math.sqrt(r * r - minDy * minDy)
  return { left: cx - maxDx - hPad, right: cx + maxDx + hPad }
}

/**
 * 기본 가로 구간(base)에서 차단 구간들(blocked)을 제외한 가용 텍스트 슬롯들을 분할(Carve)합니다.
 * (공식 pretext pages/demos/wrap-geometry.ts carveTextLineSlots 동일 알고리즘)
 */
function carveTextLineSlots(
  base: Interval,
  blocked: Interval[],
  minSlotWidth: number = 38,
): Interval[] {
  let slots: Interval[] = [base]

  for (let blockedIndex = 0; blockedIndex < blocked.length; blockedIndex++) {
    const interval = blocked[blockedIndex]!
    const next: Interval[] = []
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex]!
      if (interval.right <= slot.left || interval.left >= slot.right) {
        next.push(slot)
        continue
      }
      if (interval.left > slot.left) {
        next.push({ left: slot.left, right: interval.left })
      }
      if (interval.right < slot.right) {
        next.push({ left: interval.right, right: slot.right })
      }
    }
    slots = next
  }

  return slots.filter((slot) => slot.right - slot.left >= minSlotWidth)
}

export const ShapeFlowDemo: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [maxAvailableWidth, setMaxAvailableWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(580, window.innerWidth - 40) : 580
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

  const effectiveWidth = Math.max(280, Math.min(CONTAINER_WIDTH, maxAvailableWidth))

  // 장애물(원형 프로필/배지) 위치 및 반경 - 기본 위치 중앙
  const [obstacleX, setObstacleX] = useState<number>(() => Math.floor(effectiveWidth / 2))
  const [obstacleY, setObstacleY] = useState<number>(190)
  const [obstacleRadius, setObstacleRadius] = useState<number>(55)

  const effectiveObstacleX = Math.max(
    obstacleRadius + 10,
    Math.min(effectiveWidth - obstacleRadius - 10, obstacleX)
  )

  // 직접 드래그앤드롭 상태
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragStartRef = useRef<{
    startX: number
    startY: number
    initX: number
    initY: number
  } | null>(null)

  // 1회성 전처리: prepareWithSegments (라인별 커서 기반 탐색을 위해 세그먼트 보존)
  const prepared = useMemo(() => {
    return prepareWithSegments(ARTICLE_TEXT, FONT)
  }, [])

  // ============================================================================
  // [Pretext 다중 슬롯 장애물 회피 레이아웃 (공식 editorial-engine.ts 기반)]
  // ============================================================================
  const lines = useMemo(() => {
    const resultLines: Array<{ text: string; x: number; y: number; width: number }> = []
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineTop = 14
    const maxY = CONTAINER_HEIGHT - 12
    const baseInterval: Interval = { left: 14, right: effectiveWidth - 14 }

    while (lineTop + LINE_HEIGHT <= maxY) {
      const bandTop = lineTop
      const bandBottom = lineTop + LINE_HEIGHT

      // 1. 현재 라인 높이 밴드와 원형 장애물과의 수평 침범 구간(blocked) 계산
      const blocked: Interval[] = []
      const circleInterval = circleIntervalForBand(
        effectiveObstacleX,
        obstacleY,
        obstacleRadius,
        bandTop,
        bandBottom,
        14, // hPad
        4,  // vPad
      )
      if (circleInterval !== null) {
        blocked.push(circleInterval)
      }

      // 2. 가용 텍스트 슬롯 분할 (장애물과 겹치면 좌측 슬롯, 우측 슬롯으로 2개 생성!)
      const slots = carveTextLineSlots(baseInterval, blocked, 38)
      if (slots.length === 0) {
        lineTop += LINE_HEIGHT
        continue
      }

      // 3. 좌측 -> 우측 순서대로 슬롯 정렬
      const orderedSlots = [...slots].sort((a, b) => a.left - b.left)

      // 4. ⚡ 각 슬롯마다 커서를 이어받으며 layoutNextLine() 호출
      for (let slotIndex = 0; slotIndex < orderedSlots.length; slotIndex++) {
        const slot = orderedSlots[slotIndex]!
        const slotWidth = slot.right - slot.left

        let line = layoutNextLine(prepared, cursor, slotWidth)
        if (line === null) {
          // 뷰포트 영역 전체를 텍스트로 가득 채우기 위해 텍스트 끝에 도달하면 커서를 시작으로 순환
          cursor = { segmentIndex: 0, graphemeIndex: 0 }
          line = layoutNextLine(prepared, cursor, slotWidth)
        }

        if (!line) continue

        resultLines.push({
          text: line.text,
          x: Math.round(slot.left),
          y: Math.round(lineTop),
          width: Math.round(line.width),
        })

        // 직전 슬롯 끝 지점의 커서(line.end)가 다음 슬롯의 시작 커서로 연결됨!
        cursor = line.end
      }

      lineTop += LINE_HEIGHT
    }

    return resultLines
  }, [prepared, obstacleX, obstacleY, obstacleRadius])

  // 양방향 분할 라인 수 (좌/우 양쪽 모두 텍스트가 채워진 줄 수)
  const dualSlotLineCount = useMemo(() => {
    const yCounts = new Map<number, number>()
    for (const l of lines) {
      yCounts.set(l.y, (yCounts.get(l.y) || 0) + 1)
    }
    let count = 0
    for (const c of yCounts.values()) {
      if (c > 1) count++
    }
    return count
  }, [lines])

  // 드래그 핸들러 (Pointer Capture를 활용한 매끄러운 60fps 드래그)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: obstacleX,
      initY: obstacleY,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    e.preventDefault()
    const dx = e.clientX - dragStartRef.current.startX
    const dy = e.clientY - dragStartRef.current.startY

    const minX = Math.round(obstacleRadius + 10)
    const maxX = Math.round(effectiveWidth - obstacleRadius - 10)
    const minY = Math.round(obstacleRadius + 10)
    const maxY = Math.round(CONTAINER_HEIGHT - obstacleRadius - 10)

    const newX = Math.max(minX, Math.min(maxX, dragStartRef.current.initX + dx))
    const newY = Math.max(minY, Math.min(maxY, dragStartRef.current.initY + dy))

    setObstacleX(newX)
    setObstacleY(newY)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore if already released
      }
      setIsDragging(false)
      dragStartRef.current = null
    }
  }

  const shapeFlowCode = `// ------------------------------------------------------------------
// [자유 형태 장애물 양방향 텍스트 래핑: Dual-Slot Obstacle Wrapping]
// ------------------------------------------------------------------
import { prepareWithSegments, layoutNextLine, type LayoutCursor } from '@chenglou/pretext';

// 1. 텍스트 전처리 (1회만 수행)
const prepared = prepareWithSegments(articleText, FONT);
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
let lineTop = 14;

// 2. 라인 밴드별 기하학적 슬롯 분할 및 커서 라우팅
while (lineTop + LINE_HEIGHT <= CONTAINER_HEIGHT) {
  const bandTop = lineTop;
  const bandBottom = lineTop + LINE_HEIGHT;

  // 원형 장애물과 겹치는 수평 차단 구간(Interval) 계산
  const blocked = circleIntervalForBand(obstacle.x, obstacle.y, obstacle.r, bandTop, bandBottom);
  
  // 기본 너비에서 장애물 침범 구간을 빼내어 좌/우 가용 슬롯(Slots)으로 분할
  // e.g. [ { left: 14, right: 220 }, { left: 360, right: 566 } ]
  const slots = carveTextLineSlots({ left: 14, right: CONTAINER_WIDTH - 14 }, blocked);

  // ⚡ 좌측 슬롯 -> 우측 슬롯 순으로 커서를 연속 전달하며 layoutNextLine() 호출
  for (const slot of slots) {
    const slotWidth = slot.right - slot.left;
    let line = layoutNextLine(prepared, cursor, slotWidth);
    if (!line) {
      cursor = { segmentIndex: 0, graphemeIndex: 0 }; // 텍스트 순환
      line = layoutNextLine(prepared, cursor, slotWidth);
    }
    
    renderLine(line.text, slot.left, lineTop);
    cursor = line.end; // ⚡ 좌측 끝 커서가 우측 시작 커서로 즉시 연결!
  }

  lineTop += LINE_HEIGHT;
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

// 💡 왜 CSS는 불가능하고 Pretext로는 60fps 양방향 래핑이 가능한가?
// 1. CSS float / shape-outside:
//    - float 속성의 구조적 한계로 오직 왼쪽 또는 오른쪽 한 방향으로만 텍스트를 흘려보낼 수 있음.
//    - 장애물 오브젝트의 좌측과 우측을 동시에 텍스트로 채우는 "양방향 슬롯 래핑"이 CSS만으로는 원천 불가함.
//    - 위치 변경 시 브라우저 레이아웃 트리가 전면 무효화되어 심각한 프레임 드랍(Layout Thrashing) 유발.
//
// 2. Pretext 커서 라우팅:
//    - DOM에 렌더링하기 전에 슬롯 기하(Interval)를 수식으로 구하고 layoutNextLine()을 호출함.
//    - 좌측 슬롯의 끝 커서(end)가 우측 슬롯의 시작 커서(start)로 바로 이어지므로 글의 단절이 없음.
//    - DOM 측정 없는 순수 산술 연산이므로 드래그 중에도 항상 완벽한 60fps를 유지함!
`;

  const shapeFlowComparisonCodeSample = `// ------------------------------------------------------------------
// [CSS shape-outside vs Pretext 커서 기반 슬롯 라우팅 비교]
// ------------------------------------------------------------------

/* ❌ 1. CSS의 태생적 한계: shape-outside & float
 * - float: left 또는 float: right 중 하나만 선택 가능.
 *   장애물 좌측과 우측 양쪽 모두에 텍스트를 채우는 '양방향 동시 래핑'이 웹 표준 CSS만으로는 원천 불가!
 * - 장애물 위치를 JS(마우스 드래그)로 변경할 때마다:
 *   브라우저 메인 스레드는 전체 DOM 트리의 인라인 포맷팅 컨텍스트(IFC)를 무효화하여
 *   심각한 프레임 드랍(60fps -> 15fps)과 배터리 소모를 유발함.
 */

/* ✅ 2. Pretext 커서 기반 다중 슬롯 라우팅 (Cursor Slot Routing)
 * - 기하학 공식으로 라인 밴드와 장애물의 교집합을 계산하여 좌/우 슬롯(Interval)으로 분할.
 * - 직전 슬롯에서 단어가 끝난 커서(cursor.end)를 다음 슬롯의 시작점으로 주입!
 * - DOM 레이아웃 트리가 전혀 관여하지 않으므로:
 *   마우스나 터치로 원형/다각형 오브젝트를 아무리 빠르게 휘저어도 60fps 무감속 유지!
 */
`;

  return (
    <div className="demo-wrapper" ref={wrapperRef}>
      <div className="demo-card">
        <div className="demo-card-header">
          <div className="demo-card-title">
            <span>🌊 자유 형태 텍스트 래핑 (Shape Flow / Obstacle Wrapping)</span>
            <span className="pure-math-tag">⚡ 60FPS 실시간 드래그</span>
          </div>
          <div className="demo-card-desc">
            `layoutNextLine()` 커서 기반 API와 슬롯 분할(Carving) 기하 알고리즘을 결합하여, 
            장애물 오브젝트의 <strong>좌측과 우측 양방향 모두</strong>에 텍스트가 물 흐르듯 가득 차도록 실시간 래핑합니다.
            파란색 원형 오브젝트를 <strong>직접 마우스나 터치로 드래그</strong>해 보세요!
          </div>
        </div>

        {/* 인터랙티브 상태 배지 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div className="metric-pill">
            <span>총 출력 줄 수:</span>
            <strong>{lines.length}줄</strong>
          </div>
          <div className="metric-pill" style={{ color: 'var(--accent-purple)', borderColor: 'rgba(188, 140, 255, 0.3)', background: 'rgba(188, 140, 255, 0.15)' }}>
            <span>양방향 분할 라인:</span>
            <strong>{dualSlotLineCount}줄 (좌/우 동시 래핑)</strong>
          </div>
          <div className="metric-pill" style={{ color: 'var(--accent-blue)', borderColor: 'rgba(88, 166, 255, 0.3)', background: 'rgba(88, 166, 255, 0.15)' }}>
            <span>오브젝트 좌표:</span>
            <strong>X: {effectiveObstacleX}px, Y: {obstacleY}px (R: {obstacleRadius}px)</strong>
          </div>
        </div>

        {/* 조작 패널 */}
        <div className="control-panel">
          <div className="control-group">
            <span className="control-label">장애물 X 위치: {effectiveObstacleX}px</span>
            <input
              type="range"
              min={Math.round(obstacleRadius + 10)}
              max={Math.round(effectiveWidth - obstacleRadius - 10)}
              value={effectiveObstacleX}
              onChange={(e) => setObstacleX(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <span className="control-label">장애물 Y 위치: {obstacleY}px</span>
            <input
              type="range"
              min={70}
              max={345}
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

        {/* 빠른 위치 프리셋 버튼들 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            위치 프리셋:
          </span>
          <button
            type="button"
            className="tab-btn"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { setObstacleX(Math.floor(effectiveWidth / 2)); setObstacleY(190); }}
          >
            🎯 중앙 (양방향 분할 래핑)
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { setObstacleX(Math.max(obstacleRadius + 10, Math.floor(effectiveWidth * 0.25))); setObstacleY(190); }}
          >
            ⬅️ 좌측 배치 (우측 래핑)
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { setObstacleX(Math.min(effectiveWidth - obstacleRadius - 10, Math.floor(effectiveWidth * 0.75))); setObstacleY(190); }}
          >
            ➡️ 우측 배치 (좌측 래핑)
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { setObstacleX(Math.floor(effectiveWidth / 2)); setObstacleY(90); }}
          >
            ⬆️ 상단 중앙
          </button>
        </div>

        {/* 인터랙티브 래핑 뷰포트 */}
        <div
          style={{
            position: 'relative',
            width: `${effectiveWidth}px`,
            maxWidth: '100%',
            height: `${CONTAINER_HEIGHT}px`,
            background: '#090d13',
            border: '1px solid #30363d',
            borderRadius: '10px',
            margin: '0 auto',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* 직접 드래그 가능한 장애물 원형 오브젝트 */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              left: `${effectiveObstacleX - obstacleRadius}px`,
              top: `${obstacleY - obstacleRadius}px`,
              width: `${obstacleRadius * 2}px`,
              height: `${obstacleRadius * 2}px`,
              borderRadius: '50%',
              background: isDragging
                ? 'radial-gradient(circle at 30% 30%, #79c0ff, #1f6feb)'
                : 'radial-gradient(circle at 30% 30%, #58a6ff, #0969da)',
              boxShadow: isDragging
                ? '0 0 36px rgba(88, 166, 255, 0.85), inset 0 0 12px rgba(255, 255, 255, 0.5)'
                : '0 0 22px rgba(88, 166, 255, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              zIndex: 20,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
              border: isDragging ? '2px solid #ffffff' : '2px solid rgba(255, 255, 255, 0.45)',
              transform: isDragging ? 'scale(1.04)' : 'scale(1)',
              transition: isDragging ? 'none' : 'transform 0.15s ease, box-shadow 0.2s ease',
            }}
          >
            <span style={{ fontSize: '11px', letterSpacing: '0.8px', opacity: 0.9 }}>OBSTACLE</span>
            <span style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
              {isDragging ? '⚡ 이동 중' : '✋ 드래그'}
            </span>
            <span style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>
              ({obstacleX}, {obstacleY})
            </span>
          </div>

          {/* 라인별 텍스트 출력 */}
          {lines.map((item, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${item.width}px`,
                height: `${LINE_HEIGHT}px`,
                lineHeight: `${LINE_HEIGHT}px`,
                fontSize: '15px',
                color: '#e6edf3',
                whiteSpace: 'nowrap',
                pointerEvents: 'none', // 텍스트가 드래그 인터랙션을 가로막지 않도록 설정
              }}
            >
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* 소스 코드 뷰어 (탭 지원) */}
      <CodeViewer
        title="layoutNextLine() 다중 슬롯 커서 라우팅 및 라이브러리 내부 소스코드"
        snippets={[
          {
            tabLabel: '📱 컴포넌트 래핑 코드',
            filePath: 'src/demos/ShapeFlowDemo.tsx',
            code: shapeFlowCode,
            explanation: '각 줄마다 carveTextLineSlots()로 장애물 좌/우 슬롯을 구하고, 좌측 슬롯의 끝 커서(end)를 우측 슬롯의 시작 커서로 넘겨 텍스트 연속성을 유지하며 양쪽 모두 채웁니다.',
          },
          {
            tabLabel: '🔬 라이브러리 내부 핵심 코드 (@chenglou/pretext)',
            filePath: 'pretext/src/layout.ts (layoutNextLine)',
            code: shapeFlowLibraryCodeSample,
            explanation: 'CSS float는 구조상 단방향 래핑만 가능하지만, Pretext는 순수 산술 연산으로 다중 슬롯에 커서를 넘길 수 있어 60fps 양방향 실시간 래핑이 가능합니다.',
          },
          {
            tabLabel: '🌊 CSS shape-outside vs Pretext 비교',
            filePath: 'W3C CSS Shapes Module vs Pretext Geometry',
            code: shapeFlowComparisonCodeSample,
            explanation: 'CSS shape-outside의 단방향 제약 및 레이아웃 스래싱 한계와, Pretext 커서 라우팅의 양방향 래핑 및 60fps 성능 이점을 비교 분석합니다.',
          },
        ]}
      />
    </div>
  )
}
