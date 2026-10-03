import React, { useState, useRef, useCallback, useEffect } from 'react'
import { dxfToViewportPct, screenToDxf, polygonCentroid } from '../utils/coordinateUtils'

export default function CenterPointStep({
  floorPlanImg,
  imageExtent,
  drawingBounds,
  effectiveCenter,
  centerMode,
  manualCenter,
  houseBoundary,
  onCenterStateChange,
  onEditStart,
  onEditEnd,
  isSubmitting = false,
  onBack,
  onNext,
}) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  // When an interaction starts on a vertex/center marker, suppress the click
  // that fires on release so we don't add a spurious boundary point.
  const clickGuardRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [viewport, setViewport] = useState(null)
  const [loadedImageSource, setLoadedImageSource] = useState(null)
  const imageLoaded = Boolean(floorPlanImg && loadedImageSource === floorPlanImg)

  const [draggingVertexIndex, setDraggingVertexIndex] = useState(null)
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(null)

  // Observe container size to trigger re-renders for coordinate positioning
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect
        setViewport({
          width,
          height,
          imageWidth: imgRef.current?.naturalWidth || 1500,
          imageHeight: imgRef.current?.naturalHeight || 1500,
        })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Drag the Brahmasthan center marker
  const updateCenterPosition = useCallback((clientX, clientY) => {
    if (!containerRef.current || !imgRef.current || !imageExtent || !drawingBounds) return
    const dxf = screenToDxf(clientX, clientY, containerRef.current, imgRef.current, imageExtent)
    
    // Clamp center dragging to drawingBounds
    const clampedX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, dxf.x))
    const clampedY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, dxf.y))
    
    onCenterStateChange({
      centerMode: 'manual',
      manualCenter: { x: clampedX, y: clampedY },
    })
  }, [imageExtent, drawingBounds, onCenterStateChange])

  const handleCenterPointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    clickGuardRef.current = true
    onEditStart?.()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    updateCenterPosition(e.clientX, e.clientY)
  }

  const handleCenterPointerMove = (e) => {
    if (!isDragging) return
    updateCenterPosition(e.clientX, e.clientY)
  }

  const handleCenterPointerUp = () => {
    if (isDragging) onEditEnd?.()
    setIsDragging(false)
  }

  // Handle vertex dragging
  const handleVertexPointerDown = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    clickGuardRef.current = true
    onEditStart?.()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingVertexIndex(index)
    setSelectedVertexIndex(index)
  }

  const handleVertexPointerMove = (e) => {
    if (draggingVertexIndex === null || !containerRef.current || !imgRef.current || !imageExtent || !drawingBounds) return
    const dxf = screenToDxf(e.clientX, e.clientY, containerRef.current, imgRef.current, imageExtent)
    
    const clampedX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, dxf.x))
    const clampedY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, dxf.y))
    
    const updated = [...(houseBoundary || [])]
    updated[draggingVertexIndex] = { x: clampedX, y: clampedY }
    onCenterStateChange({ houseBoundary: updated })
  }

  const handleVertexPointerUp = () => {
    if (draggingVertexIndex !== null) onEditEnd?.()
    setDraggingVertexIndex(null)
  }

  const handleVertexContextMenu = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = (houseBoundary || []).filter((_, i) => i !== index)
    onCenterStateChange({ houseBoundary: updated.length > 0 ? updated : null })
  }

  const handleCenterKeyDown = (e) => {
    if (!drawingBounds) return
    let dx = 0
    let dy = 0
    const stepX = (drawingBounds.max_x - drawingBounds.min_x) / 100
    const stepY = (drawingBounds.max_y - drawingBounds.min_y) / 100
    const factor = e.shiftKey ? 5 : 1

    if (e.key === 'ArrowUp') {
      dy = stepY * factor
    } else if (e.key === 'ArrowDown') {
      dy = -stepY * factor
    } else if (e.key === 'ArrowLeft') {
      dx = -stepX * factor
    } else if (e.key === 'ArrowRight') {
      dx = stepX * factor
    } else {
      return
    }

    e.preventDefault()
    // Resolve current cx/cy
    let currentX = cx
    let currentY = cy
    if (centerMode === 'manual' && manualCenter) {
      currentX = manualCenter.x
      currentY = manualCenter.y
    } else if (centerMode === 'boundary' && houseBoundary && houseBoundary.length >= 3) {
      const centroid = polygonCentroid(houseBoundary)
      currentX = centroid.x
      currentY = centroid.y
    } else if (drawingBounds) {
      currentX = drawingBounds.auto_cx ?? (drawingBounds.min_x + drawingBounds.max_x) / 2
      currentY = drawingBounds.auto_cy ?? (drawingBounds.min_y + drawingBounds.max_y) / 2
    }

    const newX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, currentX + dx))
    const newY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, currentY + dy))
    onCenterStateChange({
      centerMode: 'manual',
      manualCenter: { x: newX, y: newY },
    })
  }

  const handleVertexKeyDown = (e, index) => {
    if (!drawingBounds || !houseBoundary) return
    let dx = 0
    let dy = 0
    const stepX = (drawingBounds.max_x - drawingBounds.min_x) / 100
    const stepY = (drawingBounds.max_y - drawingBounds.min_y) / 100
    const factor = e.shiftKey ? 5 : 1

    if (e.key === 'ArrowUp') {
      dy = stepY * factor
    } else if (e.key === 'ArrowDown') {
      dy = -stepY * factor
    } else if (e.key === 'ArrowLeft') {
      dx = -stepX * factor
    } else if (e.key === 'ArrowRight') {
      dx = stepX * factor
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const updated = houseBoundary.filter((_, i) => i !== index)
      onCenterStateChange({ houseBoundary: updated.length > 0 ? updated : null })
      setSelectedVertexIndex(null)
      e.preventDefault()
      return
    } else {
      return
    }

    e.preventDefault()
    const vertex = houseBoundary[index]
    const newX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, vertex.x + dx))
    const newY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, vertex.y + dy))

    const updated = [...houseBoundary]
    updated[index] = { x: newX, y: newY }
    onCenterStateChange({ houseBoundary: updated })
    setSelectedVertexIndex(index)
  }

  // Fresh interaction on empty plan area — allow the upcoming click to add a point
  const handleContainerPointerDown = () => {
    clickGuardRef.current = false
  }

  // Container click: Add new points to boundary
  const handleContainerClick = (e) => {
    // Ignore the click that ends a vertex/center drag (prevents spurious points)
    if (clickGuardRef.current) {
      clickGuardRef.current = false
      return
    }
    if (centerMode !== 'boundary' || !containerRef.current || !imgRef.current || !imageExtent) return

    // Add point (clamped to the drawing bounds, consistent with vertex dragging)
    const dxf = screenToDxf(e.clientX, e.clientY, containerRef.current, imgRef.current, imageExtent)
    let point = dxf
    if (drawingBounds) {
      point = {
        x: Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, dxf.x)),
        y: Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, dxf.y)),
      }
    }
    const newPoints = [...(houseBoundary || []), point]
    onCenterStateChange({ houseBoundary: newPoints, centerMode: 'boundary' })
  }

  // Delete selected vertex manually
  const handleDeleteSelectedVertex = () => {
    if (selectedVertexIndex === null || !houseBoundary) return
    const updated = houseBoundary.filter((_, i) => i !== selectedVertexIndex)
    onCenterStateChange({ houseBoundary: updated.length > 0 ? updated : null })
    setSelectedVertexIndex(null)
  }

  // Get active center coordinates
  let cx = 0, cy = 0
  if (centerMode === 'manual' && manualCenter) {
    cx = manualCenter.x
    cy = manualCenter.y
  } else if (centerMode === 'boundary' && houseBoundary && houseBoundary.length >= 3) {
    const center = effectiveCenter || polygonCentroid(houseBoundary)
    cx = center.x
    cy = center.y
  } else if (drawingBounds) {
    cx = effectiveCenter?.x ?? drawingBounds.auto_cx ?? (drawingBounds.min_x + drawingBounds.max_x) / 2
    cy = effectiveCenter?.y ?? drawingBounds.auto_cy ?? (drawingBounds.min_y + drawingBounds.max_y) / 2
  }

  // Convert center coordinates to percentages for screen placement
  let markerStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'none' }
  if (imageExtent && viewport && imageLoaded) {
    const pct = dxfToViewportPct(cx, cy, imageExtent, viewport)
    markerStyle = {
      left: `${pct.pctX}%`,
      top: `${pct.pctY}%`,
      transform: 'translate(-50%, -50%)',
      cursor: isDragging ? 'grabbing' : 'grab',
    }
  } else if (drawingBounds) {
    markerStyle = {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  // Convert polygon vertices to screen pixel positions
  const svgPoints = imageExtent && viewport && imageLoaded && houseBoundary
    ? houseBoundary.map((pt) => dxfToViewportPct(pt.x, pt.y, imageExtent, viewport))
    : []
  const nextDisabled = isSubmitting
    || (centerMode === 'boundary' && (!houseBoundary || houseBoundary.length < 3))
    || (centerMode === 'manual' && !manualCenter)

  return (
    <div
      className="flex flex-col h-full animate-fadeSlideIn"
      onPointerMove={(e) => {
        handleCenterPointerMove(e)
        if (draggingVertexIndex !== null) handleVertexPointerMove(e)
      }}
      onPointerUp={(e) => {
        handleCenterPointerUp(e)
        if (draggingVertexIndex !== null) handleVertexPointerUp(e)
      }}
      onPointerCancel={(e) => {
        handleCenterPointerUp(e)
        if (draggingVertexIndex !== null) handleVertexPointerUp(e)
      }}
      style={{ touchAction: 'none' }}
    >
      {/* Top bar with mode selector */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-bold text-stone-700 tracking-tight">Set Brahmasthan</h2>
          <p className="text-[12px] text-stone-400 mt-0.5 leading-snug">
            {centerMode === 'boundary'
              ? 'Click on plan to add boundary corners. Drag vertices to adjust.'
              : 'Drag marker to set manual position, or use boundary centroid.'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => {
              onCenterStateChange({
                centerMode: 'automatic',
                manualCenter: null,
                houseBoundary: null,
              })
              setSelectedVertexIndex(null)
            }}
            className={`h-8 px-3 border rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              centerMode === 'automatic'
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            Automatic Center
          </button>
          <button
            type="button"
            onClick={() => {
              const automaticX = drawingBounds
                ? drawingBounds.auto_cx ?? (drawingBounds.min_x + drawingBounds.max_x) / 2
                : 0
              const automaticY = drawingBounds
                ? drawingBounds.auto_cy ?? (drawingBounds.min_y + drawingBounds.max_y) / 2
                : 0
              const initialCenter = manualCenter || effectiveCenter || {
                x: automaticX,
                y: automaticY,
              }
              onCenterStateChange({ centerMode: 'manual', manualCenter: initialCenter })
            }}
            className={`h-8 px-3 border rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              centerMode === 'manual'
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            Manual Position
          </button>
          <button
            type="button"
            onClick={() => {
              onCenterStateChange({ centerMode: 'boundary' })
            }}
            className={`h-8 px-3 border rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              centerMode === 'boundary'
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            Define Boundary
          </button>

          {selectedVertexIndex !== null && (
            <button
              type="button"
              onClick={handleDeleteSelectedVertex}
              className="h-8 px-2.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
            >
              Delete Point
            </button>
          )}

          {houseBoundary && houseBoundary.length > 0 && (
             <button
              type="button"
              onClick={() => {
                const updated = houseBoundary.slice(0, -1)
                onCenterStateChange({ houseBoundary: updated.length > 0 ? updated : null })
                setSelectedVertexIndex(null)
              }}
              className="h-8 px-3 border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
            >
              Undo Point
            </button>
          )}

          {houseBoundary && (
            <button
              type="button"
              onClick={() => {
                onCenterStateChange({
                  houseBoundary: null,
                  ...(centerMode === 'boundary' ? { centerMode: 'automatic' } : {}),
                })
                setSelectedVertexIndex(null)
              }}
              className="h-8 px-3 border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
            >
              Clear Boundary
            </button>
          )}
        </div>
      </div>

      {/* Floor plan area */}
      <div
        ref={containerRef}
        onPointerDown={handleContainerPointerDown}
        onClick={handleContainerClick}
        className="flex-1 relative border border-stone-100 rounded-2xl overflow-hidden bg-stone-50/50 flex items-center justify-center"
        style={{ cursor: centerMode === 'boundary' ? 'crosshair' : (isDragging ? 'grabbing' : 'default'), minHeight: '260px' }}
      >
        {floorPlanImg ? (
          <img
            ref={imgRef}
            src={`data:image/png;base64,${floorPlanImg}`}
            alt="Floor Plan"
            className="max-w-full max-h-full object-contain pointer-events-none select-none"
            draggable={false}
            onLoad={(event) => {
              setLoadedImageSource(floorPlanImg)
              const rect = containerRef.current?.getBoundingClientRect()
              if (rect) {
                setViewport({
                  width: rect.width,
                  height: rect.height,
                  imageWidth: event.currentTarget.naturalWidth || 1500,
                  imageHeight: event.currentTarget.naturalHeight || 1500,
                })
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin-slow w-6 h-6 text-stone-300" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
            <p className="text-stone-300 text-sm font-medium">Loading floor plan…</p>
          </div>
        )}

        {/* SVG overlay for drawing boundary */}
        {imageLoaded && houseBoundary && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Draw closed filled polygon */}
            {svgPoints.length >= 3 && (
              <polygon
                points={svgPoints.map(p => `${p.px},${p.py}`).join(' ')}
                fill="rgba(234, 88, 12, 0.15)"
                stroke="#EA580C"
                strokeWidth="2.5"
              />
            )}

            {/* Draw open path line if only 2 points */}
            {svgPoints.length === 2 && (
              <line
                x1={svgPoints[0].px}
                y1={svgPoints[0].py}
                x2={svgPoints[1].px}
                y2={svgPoints[1].py}
                stroke="#EA580C"
                strokeWidth="2.5"
              />
            )}

            {/* Boundary Vertices (Interactive) */}
            {svgPoints.map((pt, i) => (
              <g
                key={`vertex-${i}`}
                className="pointer-events-auto"
                tabIndex={0}
                role="slider"
                aria-label={`Boundary point ${i + 1}`}
                onKeyDown={(e) => handleVertexKeyDown(e, i)}
                style={{ outline: 'none' }}
              >
                {/* Large invisible touch target */}
                <circle
                  cx={pt.px}
                  cy={pt.py}
                  r="22"
                  fill="transparent"
                  style={{ cursor: draggingVertexIndex === i ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => handleVertexPointerDown(e, i)}
                  onPointerUp={handleVertexPointerUp}
                  onPointerCancel={handleVertexPointerUp}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedVertexIndex(i)
                  }}
                  onContextMenu={(e) => handleVertexContextMenu(e, i)}
                />
                {/* Visible vertex dot */}
                <circle
                  cx={pt.px}
                  cy={pt.py}
                  r={selectedVertexIndex === i ? '8' : '5.5'}
                  fill="#EA580C"
                  stroke="white"
                  strokeWidth="2.5"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            ))}
          </svg>
        )}

        {/* Draggable center point (Brahmasthan marker) */}
        <div
          onPointerDown={handleCenterPointerDown}
          onPointerUp={handleCenterPointerUp}
          onPointerCancel={handleCenterPointerUp}
          onKeyDown={handleCenterKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Brahmasthan center point"
          className="absolute z-20"
          style={{
            ...markerStyle,
            outline: 'none',
          }}
        >
          {/* Label */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap shadow-md pointer-events-none">
            Brahmasthan
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-stone-800" />
          </div>

          {/* Outer glow ring */}
          <div
            className="w-11 h-11 rounded-full border-[3px] border-white flex items-center justify-center animate-pulse-ring shadow-lg"
            style={{ backgroundColor: '#EA580C' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F3F4F6', marginTop: '16px' }}>
        <p style={{ fontSize: '13px', color: '#78716C', lineHeight: 1.5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, color: '#57534E' }}>Tip:</span>{' '}
          {centerMode === 'boundary'
            ? 'Define the house boundaries to auto-calculate the center centroid, or drag the center marker directly.'
            : 'Drag the Brahmasthan marker to customize the center, or draw a boundary perimeter.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              minWidth: '100px',
              height: '44px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#F3F4F6',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E7EB' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6' }}
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled}
            style={{
              minWidth: '100px',
              height: '44px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: nextDisabled ? '#D1D5DB' : '#EAB308',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              cursor: nextDisabled ? 'not-allowed' : 'pointer',
              boxShadow: nextDisabled ? 'none' : '0 3px 10px rgba(234,179,8,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!nextDisabled) {
                e.currentTarget.style.backgroundColor = '#CA8A04'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!nextDisabled) {
                e.currentTarget.style.backgroundColor = '#EAB308'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {isSubmitting ? 'Analysing…' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
