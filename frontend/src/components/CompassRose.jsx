import React, { useState, useRef, useCallback, useId } from 'react'
import { getRoomStatus, statusColor } from '../utils/roomStatus'
import { normalizeDegrees } from '../utils/analysisInput'

const SEGMENTS = [
  { dir: 'N',  start: -22.5, end: 22.5,  color: '#7DD3FC' },
  { dir: 'NE', start: 22.5,  end: 67.5,  color: '#86EFAC' },
  { dir: 'E',  start: 67.5,  end: 112.5, color: '#BEF264' },
  { dir: 'SE', start: 112.5, end: 157.5, color: '#FDE047' },
  { dir: 'S',  start: 157.5, end: 202.5, color: '#FCA5A5' },
  { dir: 'SW', start: 202.5, end: 247.5, color: '#FDBA74' },
  { dir: 'W',  start: 247.5, end: 292.5, color: '#FB923C' },
  { dir: 'NW', start: 292.5, end: 337.5, color: '#67E8F9' },
]

const DEGREE_TICKS = Array.from({ length: 16 }, (_, i) => i * 22.5)

function bearingToXY(bearing, radius, cx, cy) {
  const rad = (bearing * Math.PI) / 180
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) }
}

function arcPath(startB, endB, outerR, innerR, cx, cy) {
  const s1 = bearingToXY(startB, outerR, cx, cy)
  const e1 = bearingToXY(endB, outerR, cx, cy)
  const e2 = bearingToXY(endB, innerR, cx, cy)
  const s2 = bearingToXY(startB, innerR, cx, cy)
  return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 0 1 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${innerR} ${innerR} 0 0 0 ${s2.x} ${s2.y} Z`
}

export default function CompassRose({
  size = 460, // Used for CSS width/height if numeric, or raw string if "100%"
  northOffset = 0,
  floorPlanImg,
  roomDots = [],
  hoveredRoomIndex = null, // legacy index
  selectedRoomId = null,
  hoveredRoomId = null,
  onRoomClick,
  onRoomHover,
  drawingBounds,
  imageExtent,
  interactive = false,
  onNorthOffsetChange,
  onInteractionStart,
  onInteractionEnd,
  showDegreeLabels = true,
  showDirectionLines = true,
  showMarkers = true,
  showRoomLabels = false,
  enlarged = false,
  enlargedPrint = false,
}) {
  const V = 500
  const cx = V / 2
  const cy = V / 2
  const isEnlargedMode = enlarged || enlargedPrint
  const outerR = isEnlargedMode ? 236 : 210
  const innerR = isEnlargedMode ? 222 : 150
  const imageR = isEnlargedMode ? 218 : 138

  const clipId = useId()
  const svgRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastDragAngle = useRef(0)
  const dragOffset = useRef(0)

  const dotColor = (dot) => {
    // Prefer an explicit status if one of the canonical keys; otherwise derive.
    const known = ['auspicious', 'inauspicious', 'unfavourable', 'neutral']
    const s = known.includes(dot.status) ? dot.status : getRoomStatus(dot)
    return statusColor(s)
  }

  const mapRoomToSVG = useCallback((room) => {
    const rx = room.x ?? 0
    const ry = room.y ?? 0
    if (enlargedPrint && drawingBounds && imageExtent) {
      const houseSpanX = drawingBounds.max_x - drawingBounds.min_x
      const houseSpanY = drawingBounds.max_y - drawingBounds.min_y
      const maxHouseSpan = Math.max(houseSpanX, houseSpanY)
      if (maxHouseSpan > 0) {
        const targetD = innerR * 2 * 0.82
        const scale = targetD / maxHouseSpan
        const hcx = (drawingBounds.min_x + drawingBounds.max_x) / 2
        const hcy = (drawingBounds.min_y + drawingBounds.max_y) / 2
        return {
          x: cx + (rx - hcx) * scale,
          y: cy - (ry - hcy) * scale,
        }
      }
    }

    if (!imageExtent) return { x: cx, y: cy }
    const spanX = imageExtent.x_max - imageExtent.x_min
    const spanY = imageExtent.y_max - imageExtent.y_min
    // Use a single uniform scale (largest span) so non-square extents never
    // distort the vertical placement of room dots. The backend extent is square,
    // but this keeps the mapping correct for any extent.
    const span = Math.max(spanX, spanY)
    const ecx = (imageExtent.x_min + imageExtent.x_max) / 2
    const ecy = (imageExtent.y_min + imageExtent.y_max) / 2
    if (span === 0) return { x: cx, y: cy }
    const scale = (imageR * 2) / span
    return {
      x: cx + (rx - ecx) * scale,
      y: cy - (ry - ecy) * scale, // Y inverted in SVG
    }
  }, [enlargedPrint, drawingBounds, imageExtent, innerR, imageR, cx, cy])

  // Image placement calculations
  let imgX = cx - imageR
  let imgY = cy - imageR
  let imgW = imageR * 2
  let imgH = imageR * 2

  if (enlargedPrint && drawingBounds && imageExtent) {
    const houseSpanX = drawingBounds.max_x - drawingBounds.min_x
    const houseSpanY = drawingBounds.max_y - drawingBounds.min_y
    const maxHouseSpan = Math.max(houseSpanX, houseSpanY)
    if (maxHouseSpan > 0) {
      const targetD = innerR * 2 * 0.82
      const scale = targetD / maxHouseSpan
      const hcx = (drawingBounds.min_x + drawingBounds.max_x) / 2
      const hcy = (drawingBounds.min_y + drawingBounds.max_y) / 2
      
      const ecx = (imageExtent.x_min + imageExtent.x_max) / 2
      const ecy = (imageExtent.y_min + imageExtent.y_max) / 2
      
      const imageSpanX = imageExtent.x_max - imageExtent.x_min
      const imageSpanY = imageExtent.y_max - imageExtent.y_min
      
      imgW = imageSpanX * scale
      imgH = imageSpanY * scale
      
      const imgCx = cx + (ecx - hcx) * scale
      const imgCy = cy - (ecy - hcy) * scale
      
      imgX = imgCx - imgW / 2
      imgY = imgCy - imgH / 2
    }
  }

  const getAngleFromCenter = useCallback((clientX, clientY) => {
    if (!svgRef.current) return 0
    const rect = svgRef.current.getBoundingClientRect()
    const svgCenterX = rect.left + rect.width / 2
    const svgCenterY = rect.top + rect.height / 2
    const dx = clientX - svgCenterX
    const dy = clientY - svgCenterY
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (angle < 0) angle += 360
    return angle
  }, [])

  const handlePointerDown = (e) => {
    if (!interactive) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    const angle = getAngleFromCenter(e.clientX, e.clientY)
    lastDragAngle.current = angle
    dragOffset.current = northOffset
    onInteractionStart?.()
  }

  const handlePointerMove = (e) => {
    if (!isDragging || !onNorthOffsetChange) return
    const angle = getAngleFromCenter(e.clientX, e.clientY)
    const delta = ((angle - lastDragAngle.current + 540) % 360) - 180
    dragOffset.current = normalizeDegrees(dragOffset.current + delta)
    lastDragAngle.current = angle
    onNorthOffsetChange(Math.round(dragOffset.current * 10) / 10)
  }

  const handlePointerUp = () => {
    if (isDragging) onInteractionEnd?.()
    setIsDragging(false)
  }

  const handleKeyDown = (e) => {
    if (!interactive || !onNorthOffsetChange) return
    let step = 1
    if (e.shiftKey) {
      step = 15
    }
    let change = 0
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      change = step
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      change = -step
    } else if (e.key === 'PageUp') {
      change = 22.5
    } else if (e.key === 'PageDown') {
      change = -22.5
    } else if (e.key === 'Home') {
      onNorthOffsetChange(0)
      e.preventDefault()
      return
    } else {
      return
    }

    e.preventDefault()
    onNorthOffsetChange(Math.round(normalizeDegrees(northOffset + change) * 10) / 10)
  }

  // Pre-calculate full display names (numbered per type) and nearest neighbor distances
  const processedDots = React.useMemo(() => {
    // 1. Count how many rooms exist per type so we only number duplicates
    const typeTotals = {}
    roomDots.forEach((dot) => {
      const roomType = dot.roomType || dot.room_type || dot.name || dot.type || 'Room'
      typeTotals[roomType] = (typeTotals[roomType] || 0) + 1
    })

    // 2. Build full display names: "Toilet 1", "Toilet 2"; single instances stay unnumbered
    const typeSeen = {}
    const dotsWithNames = roomDots.map((dot) => {
      const roomType = dot.roomType || dot.room_type || dot.name || dot.type || 'Room'
      typeSeen[roomType] = (typeSeen[roomType] || 0) + 1
      const displayName =
        typeTotals[roomType] > 1 ? `${roomType} ${typeSeen[roomType]}` : roomType

      return {
        ...dot,
        roomType,
        displayName,
      }
    })

    // 3. Compute SVG positions for each dot
    return dotsWithNames.map((dot) => {
      const pos = mapRoomToSVG(dot)
      return {
        ...dot,
        svgX: pos.x,
        svgY: pos.y,
      }
    })
  }, [roomDots, mapRoomToSVG])

  return (
    <svg
      ref={svgRef}
      width={size === '100%' ? '100%' : size}
      height={size === '100%' ? '100%' : size}
      viewBox={`0 0 ${V} ${V}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        overflow: 'visible',
        touchAction: 'none',
        outline: 'none',
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default'
      }}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'slider' : undefined}
      aria-label={interactive ? 'Compass orientation in degrees' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 359 : undefined}
      aria-valuenow={interactive ? northOffset : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {/* ── Floor plan image (static, clipped) ── */}
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={imageR} />
        </clipPath>
      </defs>

      {floorPlanImg && (
        <image
          href={`data:image/png;base64,${floorPlanImg}`}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          clipPath={isEnlargedMode ? undefined : `url(#${clipId})`}
          preserveAspectRatio="xMidYMid meet"
          style={isEnlargedMode ? { filter: 'invert(100%)' } : undefined}
        />
      )}

      {/* ── Inner circle border ── */}
      <circle cx={cx} cy={cy} r={imageR} fill="none" stroke="#D1D5DB" strokeWidth="1" />

      {/* ── Rotating ring group ── */}
      <g
        style={{
          transform: `rotate(${northOffset}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: isDragging ? 'none' : 'transform 0.4s ease',
          cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {/* Colored arc segments */}
        {SEGMENTS.map((seg) => (
          <path
            key={seg.dir}
            d={arcPath(seg.start, seg.end, outerR, innerR, cx, cy)}
            fill={seg.color}
            fillOpacity={isEnlargedMode ? "0.3" : "0.5"}
            stroke="white"
            strokeWidth={isEnlargedMode ? "1" : "2"}
          />
        ))}

        {/* Degree tick marks & labels */}
        {showDegreeLabels && DEGREE_TICKS.map((deg) => {
          const isMajor = deg % 45 === 0
          const outer = bearingToXY(deg, outerR + 2, cx, cy)
          const inner = bearingToXY(deg, outerR - (isMajor ? 12 : 6), cx, cy)
          const labelPos = bearingToXY(deg, outerR + 18, cx, cy)
          return (
            <g key={deg}>
              <line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#78716C" strokeWidth={isMajor ? 1.5 : 0.8}
              />
              {isMajor && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fill="#78716C"
                  fontFamily="Nunito"
                  transform={`rotate(${deg}, ${labelPos.x}, ${labelPos.y})`}
                >
                  {deg}
                </text>
              )}
            </g>
          )
        })}

        {/* Direction labels */}
        {SEGMENTS.map((seg) => {
          const mid = (seg.start + seg.end) / 2
          const pos = bearingToXY(mid, (innerR + outerR) / 2, cx, cy)
          return (
            <text
              key={`lbl-${seg.dir}`}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="16"
              fontWeight="800"
              fontFamily="Nunito"
              fill="#292524"
              letterSpacing="0.5"
            >
              {seg.dir}
            </text>
          )
        })}

        {/* North arrow (red triangle) */}
        <polygon
          points={`${cx},${cy - outerR - 5} ${cx - 7},${cy - outerR + 8} ${cx + 7},${cy - outerR + 8}`}
          fill="#DC2626"
        />

        {/* Grid lines (drawn unrotated to stay aligned with image) */}
        {showDirectionLines && (
          <g opacity="0.3">
            <line x1={cx} y1={cy - imageR} x2={cx} y2={cy + imageR} stroke="#EA580C" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={cx - imageR} y1={cy} x2={cx + imageR} y2={cy} stroke="#EA580C" strokeWidth="1" strokeDasharray="4 4" />
          </g>
        )}
        {/* Zonal Division Axes */}
        {isEnlargedMode && (
          <g opacity="0.2">
            {/* N - S */}
            <line x1={cx} y1={cy - outerR} x2={cx} y2={cy + outerR} stroke="#78716C" strokeWidth="0.8" strokeDasharray="3 4" />
            {/* E - W */}
            <line x1={cx - outerR} y1={cy} x2={cx + outerR} y2={cy} stroke="#78716C" strokeWidth="0.8" strokeDasharray="3 4" />
            {/* NE - SW */}
            <line 
              x1={cx - (outerR * Math.SQRT1_2)} y1={cy - (outerR * Math.SQRT1_2)}
              x2={cx + (outerR * Math.SQRT1_2)} y2={cy + (outerR * Math.SQRT1_2)}
              stroke="#78716C" strokeWidth="0.8" strokeDasharray="3 4"
            />
            {/* NW - SE */}
            <line 
              x1={cx - (outerR * Math.SQRT1_2)} y1={cy + (outerR * Math.SQRT1_2)}
              x2={cx + (outerR * Math.SQRT1_2)} y2={cy - (outerR * Math.SQRT1_2)}
              stroke="#78716C" strokeWidth="0.8" strokeDasharray="3 4"
            />
          </g>
        )}
      </g>

      {/* ── Room markers ── */}
      {showMarkers && processedDots.map((dot, idx) => {
        const isHovered = (hoveredRoomId && hoveredRoomId === dot.roomId) || hoveredRoomIndex === idx
        const isSelected = selectedRoomId && selectedRoomId === dot.roomId
        const sColor = dotColor(dot)
        const roomName = dot.displayName || dot.roomType || dot.room_type || dot.name || dot.type || 'Room'
        const roomDir = dot.actual_zone || dot.zone || dot.direction || ''

        return (
          <g
            key={dot.roomId || idx}
            style={{
              pointerEvents: interactive || onRoomClick || onRoomHover ? 'auto' : 'none',
              cursor: onRoomClick ? 'pointer' : 'default'
            }}
            onPointerEnter={() => onRoomHover && onRoomHover(dot.roomId || idx)}
            onPointerLeave={() => onRoomHover && onRoomHover(null)}
            onClick={(e) => {
              if (onRoomClick) {
                e.stopPropagation()
                onRoomClick(dot.roomId || idx)
              }
            }}
          >
            {/* Expanded transparent hover/click target (kept in all modes for interactivity) */}
            <circle cx={dot.svgX} cy={dot.svgY} r="14" fill="transparent" />

            {/* Standalone visible marker — only when room labels are hidden */}
            {!showRoomLabels && (
              <circle
                cx={dot.svgX} cy={dot.svgY} r={isSelected ? 7 : isHovered ? 6 : 4.5}
                fill={sColor}
                stroke="white" strokeWidth={isSelected ? 2 : 1.5}
                style={{
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  opacity: (hoveredRoomId || hoveredRoomIndex !== null || selectedRoomId) && !isHovered && !isSelected ? 0.3 : 1,
                  filter: isSelected ? `drop-shadow(0 0 6px ${sColor})` : 'none',
                }}
              />
            )}

            {/* Room labels: full room name + single status dot (no short codes) */}
            {showRoomLabels && (() => {
              const fontSizeVal = isEnlargedMode ? 10.5 : 8.5
              const charWidth = isEnlargedMode ? 6.0 : 4.8
              const dotR = isEnlargedMode ? 3.5 : 2.5

              const nameWidth = roomName.length * charWidth
              const spacing = isEnlargedMode ? 6 : 4
              const totalW = dotR * 2 + spacing + nameWidth
              const startX = dot.svgX - totalW / 2
              const dotCx = startX + dotR
              const textX = startX + dotR * 2 + spacing

              const lineSpacing = isEnlargedMode ? 13 : 10
              const y1 = dot.svgY - lineSpacing / 2 + 1
              const y2 = dot.svgY + lineSpacing / 2 + 1

              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Line 1: single status dot + full room name */}
                  <circle
                    cx={dotCx}
                    cy={y1}
                    r={dotR}
                    fill={sColor}
                  />
                  <text
                    x={textX}
                    y={y1}
                    dominantBaseline="central"
                    fontSize={fontSizeVal}
                    fontWeight="800"
                    fill="#1C1917"
                    style={{
                      fontFamily: 'Nunito, sans-serif',
                      textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white'
                    }}
                  >
                    {roomName}
                  </text>
                  {/* Line 2: (Direction) */}
                  {roomDir && (
                    <text
                      x={dot.svgX}
                      y={y2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSizeVal - 0.5}
                      fontWeight="700"
                      fill="#78716C"
                      style={{
                        fontFamily: 'Nunito, sans-serif',
                        textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white'
                      }}
                    >
                      {`(${roomDir})`}
                    </text>
                  )}
                </g>
              )
            })()}
          </g>
        )
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4} fill="#EA580C" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}
