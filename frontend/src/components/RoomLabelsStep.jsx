import React, { useState, useRef, useEffect } from 'react'
import { dxfToViewportPct, screenToDxf } from '../utils/coordinateUtils'
import { createRoomId } from '../utils/analysisInput'

const ALL_ROOM_TYPES = [
  'Kitchen', 'Main Door', 'Foyer', 'Master Bedroom', 'Toilet', 'Mandir',
  'Staircase', 'Living', 'Dining', 'Kids Bedroom', 'Guest',
  'Elders Bedroom', 'Wash', 'Balcony', 'Generic Room',
]

/* -- Loading Spinner ---------------------------------------- */
function LoadingState({ onBack }) {
  return (
    <div className="flex flex-col h-full items-center justify-center animate-fadeSlideIn">
      <h2 className="playfair text-2xl font-bold text-stone-800 mb-2 tracking-tight">Detecting Room Labels</h2>
      <p className="text-stone-400 text-[13px] mb-12 max-w-xs text-center leading-relaxed">
        Finding and matching room labels so we can analyse your Vaastu layout accurately.
      </p>

      {/* Animated magnifying glass */}
      <div className="relative w-24 h-24 animate-orbit">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="absolute inset-0 m-auto drop-shadow-sm">
          <circle cx="28" cy="28" r="18" stroke="#EA580C" strokeWidth="2.5" fill="white" />
          <g className="animate-compass-slow" style={{ transformOrigin: '28px 28px' }}>
            <circle cx="28" cy="28" r="10" stroke="#FDBA74" strokeWidth="1" fill="none" />
            <polygon points="28,18 26,26 30,26" fill="#EA580C" />
            <polygon points="28,38 26,30 30,30" fill="#FDBA74" />
            <line x1="18" y1="28" x2="38" y2="28" stroke="#FDBA74" strokeWidth="0.8" />
          </g>
          <line x1="41" y1="41" x2="56" y2="56" stroke="#EA580C" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      <button
        onClick={onBack}
        style={{
          marginTop: '56px',
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
    </div>
  )
}

/* -- Main Component ----------------------------------------- */
export default function RoomLabelsStep({
  isLoading,
  error,
  floorPlanImg,
  rooms,
  drawingBounds,
  imageExtent,
  onRoomsUpdate,
  onEditStart,
  onEditEnd,
  onRetry,
  onBack,
  onSubmit,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [showEditDropdown, setShowEditDropdown] = useState(false)
  const [placingType, setPlacingType] = useState(null)  // room type awaiting click-to-place

  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [viewport, setViewport] = useState(null)
  const [loadedImageSource, setLoadedImageSource] = useState(null)
  const imageLoaded = Boolean(floorPlanImg && loadedImageSource === floorPlanImg)
  const [dragIntent, setDragIntent] = useState(null)

  // Cancel placement mode with Escape
  useEffect(() => {
    if (!placingType) return
    const onKey = (e) => { if (e.key === 'Escape') setPlacingType(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placingType])

  // Rooms whose auto-detected label is uncertain and worth verifying
  const lowConfidenceCount = rooms.filter(
    (r) => !r.isNew && (r.confidence === 'low' || r.confidence === 'medium')
  ).length

  // Track container dimensions for coordinate calculations
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

  if (isLoading) return <LoadingState onBack={onBack} />

  // Hard failure with nothing to show — offer a retry instead of a blank screen
  if (error && !floorPlanImg) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-4 animate-fadeSlideIn px-6">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-red-500 text-xl">⚠️</span>
        </div>
        <div>
          <h3 className="text-stone-700 font-bold text-[15px]">Couldn't detect room labels</h3>
          <p className="text-stone-400 text-[13px] mt-1 max-w-sm">{error}</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button onClick={onBack} className="px-5 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm transition-all cursor-pointer">Back</button>
          {onRetry && (
            <button onClick={onRetry} className="px-5 h-10 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm shadow-md transition-all cursor-pointer">Try Again</button>
          )}
        </div>
      </div>
    )
  }

  const handleDelete = () => {
    if (selectedId === null) return
    const updated = rooms.filter((r) => r.room_id !== selectedId)
    onRoomsUpdate(updated)
    setSelectedId(null)
  }

  // Selecting a type arms placement mode — the next click on the plan drops it
  // exactly where the user wants (no more stacking everything at the center).
  const handleAddRoom = (type) => {
    setPlacingType(type)
    setShowAddDropdown(false)
    setSelectedId(null)
  }

  // Drop the pending room at the clicked plan location
  const placeRoomAt = (clientX, clientY) => {
    if (!placingType) return
    let x, y
    if (containerRef.current && imgRef.current && imageExtent) {
      const dxf = screenToDxf(clientX, clientY, containerRef.current, imgRef.current, imageExtent)
      x = dxf.x
      y = dxf.y
    } else if (drawingBounds) {
      x = drawingBounds.auto_cx ?? (drawingBounds.min_x + drawingBounds.max_x) / 2
      y = drawingBounds.auto_cy ?? (drawingBounds.min_y + drawingBounds.max_y) / 2
    } else {
      x = 0; y = 0
    }
    if (drawingBounds) {
      x = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, x))
      y = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, y))
    }
    const newRoom = {
      type: placingType,
      x, y,
      room_id: createRoomId('manual'),
      isNew: true,
      source: 'manual',
      confidence: 'high',  // user-defined ⇒ trusted
    }
    onRoomsUpdate([...rooms, newRoom])
    setSelectedId(newRoom.room_id)
    setPlacingType(null)
  }

  const handleChangeLabel = (newType) => {
    if (selectedId === null) return
    // A manual correction is a verified label ⇒ mark high confidence.
    const updated = rooms.map(r => r.room_id === selectedId ? { ...r, type: newType, confidence: 'high' } : r)
    onRoomsUpdate(updated)
    setShowEditDropdown(false)
  }

  const handleRoomKeyDown = (e, room) => {
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
    } else if (e.key === 'Enter' || e.key === ' ') {
      setSelectedId(selectedId === room.room_id ? null : room.room_id)
      setShowEditDropdown(false)
      e.preventDefault()
      return
    } else if (e.key === 'Delete') {
      const updated = rooms.filter((r) => r.room_id !== room.room_id)
      onRoomsUpdate(updated)
      if (selectedId === room.room_id) setSelectedId(null)
      e.preventDefault()
      return
    } else {
      return
    }

    e.preventDefault()
    const newX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, room.x + dx))
    const newY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, room.y + dy))
    onRoomsUpdate(rooms.map(r => r.room_id === room.room_id ? { ...r, x: newX, y: newY } : r))
  }

  const handlePointerDown = (e, roomId) => {
    e.stopPropagation()
    onEditStart?.()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const chipRect = target.getBoundingClientRect()
    setDragIntent({
      roomId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: e.clientX - (chipRect.left + chipRect.width / 2),
      offsetY: e.clientY - (chipRect.top + chipRect.height / 2),
      isDragging: false,
    })
  }

  const handlePointerMove = (e) => {
    if (!dragIntent) return
    const dx = e.clientX - dragIntent.startClientX
    const dy = e.clientY - dragIntent.startClientY
    
    // Check dragging intention threshold
    if (!dragIntent.isDragging && Math.hypot(dx, dy) < 5) return

    setDragIntent(prev => ({ ...prev, isDragging: true }))

    const dxf = screenToDxf(
      e.clientX - dragIntent.offsetX,
      e.clientY - dragIntent.offsetY,
      containerRef.current,
      imgRef.current,
      imageExtent
    )

    if (drawingBounds) {
      // Clamp coordinates to the wall geometry bounding box
      const clampedX = Math.max(drawingBounds.min_x, Math.min(drawingBounds.max_x, dxf.x))
      const clampedY = Math.max(drawingBounds.min_y, Math.min(drawingBounds.max_y, dxf.y))
      
      onRoomsUpdate(rooms.map(r => r.room_id === dragIntent.roomId ? { ...r, x: clampedX, y: clampedY } : r))
    }
  }

  const handlePointerUp = () => {
    if (!dragIntent) return
    if (!dragIntent.isDragging) {
      setSelectedId(selectedId === dragIntent.roomId ? null : dragIntent.roomId)
      setShowEditDropdown(false)
    }
    onEditEnd?.()
    setDragIntent(null)
  }

  return (
    <div className="flex flex-col h-full animate-fadeSlideIn">
      {/* Step header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-bold text-stone-700 tracking-tight">Verify Room Labels</h2>
          <p className="text-[12px] text-stone-400 mt-0.5 leading-snug">
            Drag labels to reposition them. Select a room to edit its type or delete it.
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">

          {/* Edit Label Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowEditDropdown(!showEditDropdown)}
              disabled={selectedId === null}
              className={`h-8 px-3 border rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${selectedId !== null
                  ? 'border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer'
                  : 'border-stone-100 text-stone-300 cursor-not-allowed'
                }`}
            >
              ✎ Edit Label
            </button>
            {showEditDropdown && selectedId !== null && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEditDropdown(false)} />
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-stone-100 rounded-xl shadow-xl z-20 py-1.5 w-44 max-h-56 overflow-y-auto">
                  {ALL_ROOM_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleChangeLabel(type)}
                      className="w-full text-left px-3 py-2 text-[12px] text-stone-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer font-medium transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={selectedId === null}
            title="Delete selected label"
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${selectedId !== null
                ? 'border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 cursor-pointer'
                : 'border-stone-100 text-stone-200 cursor-not-allowed'
              }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          {/* Add room dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="h-8 px-3 border border-stone-200 rounded-lg text-[11px] text-stone-500 hover:bg-stone-50 hover:text-stone-700 flex items-center gap-1.5 cursor-pointer transition-all font-bold"
            >
              + Add Room
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            {showAddDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddDropdown(false)} />
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-stone-100 rounded-xl shadow-xl z-20 py-1.5 w-44 max-h-56 overflow-y-auto">
                  {ALL_ROOM_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleAddRoom(type)}
                      className="w-full text-left px-3 py-2 text-[12px] text-stone-600 hover:bg-orange-50 hover:text-orange-700 cursor-pointer font-medium transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Placement-mode / confidence helper banner */}
      {placingType ? (
        <div className="mb-2 flex-shrink-0 flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2 animate-fadeSlideIn">
          <p className="text-[12px] text-orange-700 font-semibold min-w-0 truncate">
            Click anywhere on the plan to place <span className="font-extrabold">{placingType}</span>.
          </p>
          <button
            onClick={() => setPlacingType(null)}
            className="text-[11px] font-bold text-orange-600 hover:text-orange-800 cursor-pointer flex-shrink-0"
          >
            Cancel (Esc)
          </button>
        </div>
      ) : lowConfidenceCount > 0 ? (
        <div className="mb-2 flex-shrink-0 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
          <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">!</span>
          <p className="text-[12px] text-amber-700 font-semibold">
            {lowConfidenceCount} auto-detected {lowConfidenceCount === 1 ? 'label' : 'labels'} may be uncertain — please double-check the highlighted {lowConfidenceCount === 1 ? 'chip' : 'chips'}.
          </p>
        </div>
      ) : null}

      {/* Floor plan with chips */}
      <div
        ref={containerRef}
        className="flex-1 relative border border-stone-100 rounded-2xl overflow-hidden bg-stone-50/30"
        onPointerMove={handlePointerMove}
        onClick={(e) => {
          if (placingType) { placeRoomAt(e.clientX, e.clientY); return }
          setSelectedId(null); setShowEditDropdown(false)
        }}
        style={{ touchAction: 'none', cursor: placingType ? 'crosshair' : 'default' }}
      >
        {floorPlanImg && (
          <img
            ref={imgRef}
            src={`data:image/png;base64,${floorPlanImg}`}
            alt="Floor Plan"
            className="w-full h-full object-contain pointer-events-none select-none"
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
        )}

        {/* Room chips */}
        {imageExtent && viewport && imageLoaded && rooms.map((room) => {
          const isSelected = selectedId === room.room_id
          const isUncertain = !room.isNew && (room.confidence === 'low' || room.confidence === 'medium')
          const pct = dxfToViewportPct(room.x, room.y, imageExtent, viewport)

          return (
            <div
              key={room.room_id}
              onPointerDown={(e) => handlePointerDown(e, room.room_id)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => handleRoomKeyDown(e, room)}
              tabIndex={0}
              role="button"
              aria-label={`Room label for ${room.type}${isUncertain ? ' (please verify)' : ''}`}
              title={isUncertain ? 'Auto-detected with low confidence — please verify this label' : undefined}
              className={`absolute flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all duration-200 whitespace-nowrap select-none ${isSelected
                  ? 'bg-blue-100 border-2 border-blue-500 text-blue-800 z-10 shadow-lg scale-110 ring-2 ring-blue-400 ring-offset-1'
                  : room.isNew
                    ? 'bg-orange-50 border border-orange-300/70 text-orange-800 hover:shadow-md hover:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400'
                    : isUncertain
                      ? 'bg-amber-50 border border-amber-400 text-amber-800 hover:shadow-md hover:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400'
                      : 'bg-white/95 border border-purple-300/60 text-purple-800 hover:shadow-md hover:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-400'
                }`}
              style={{
                left: `${pct.pctX}%`,
                top: `${pct.pctY}%`,
                transform: 'translate(-50%, -50%)',
                // Disable animations dynamically while dragging so it moves smoothly
                transition: (dragIntent?.roomId === room.room_id && dragIntent?.isDragging) ? 'none' : 'left 0.2s ease, top 0.2s ease',
                touchAction: 'none',
                outline: 'none',
              }}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${room.isNew ? 'bg-orange-500' : isUncertain ? 'bg-amber-500' : 'bg-purple-500'}`} />
              {room.type}
              {isUncertain && <span className="text-amber-500 font-extrabold" aria-hidden="true">?</span>}
            </div>
          )
        })}

        {rooms.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-stone-300 text-sm font-medium">No room labels detected. Use "+ Add Room" to manually define them.</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F3F4F6', marginTop: '16px' }}>
        <p style={{ fontSize: '13px', color: '#78716C', lineHeight: 1.5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, color: '#57534E' }}>Tip:</span> Drag labels to adjust their centers, or change room types to make sure analysis is accurate.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              minWidth: '100px', height: '44px', padding: '10px 22px', borderRadius: '10px',
              border: 'none', backgroundColor: '#F3F4F6', color: '#374151',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E7EB' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6' }}
          >
            Back
          </button>

          <button
            onClick={onSubmit}
            style={{
              minWidth: '100px', height: '44px', padding: '10px 22px', borderRadius: '10px',
              border: 'none', backgroundColor: '#EAB308', color: '#FFFFFF',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(234,179,8,0.3)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#CA8A04'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#EAB308'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
