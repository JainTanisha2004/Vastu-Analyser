import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import CompassRose from './CompassRose'
import { getRoomStatus as getStatus } from '../utils/roomStatus'
import { getScoredRooms } from '../utils/analysisInput'

// --- Icons ---
const IconClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconZoomIn = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
const IconZoomOut = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
const IconFit = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14v6h6M20 10V4h-6M10 20H4v-6M14 4h6v6"/></svg>
const IconReset = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IconSearch = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconFocus = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>

// --- Helpers ---
function getStatusConfig(status) {
  const cfg = {
    auspicious: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Auspicious' },
    inauspicious: { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Inauspicious' },
    unfavourable: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Unfavourable' },
    neutral: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: 'Neutral' },
  }
  return cfg[status] || cfg.neutral
}

// --- Custom Toggle Switch ---
const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between cursor-pointer py-1 group">
    <span className="text-[13px] font-[600] text-[#0f172a] group-hover:text-[#f97316] transition-colors">{label}</span>
    <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-[#16a34a]' : 'bg-[#e5e7eb]'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
    <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
  </label>
)

export default function VastuMapAnalysisView({
  analysisData,
  northOffset,
  drawingBounds,
  imageExtent,
  onClose
}) {
  // 1. Data Normalization
  const normalizedRooms = useMemo(() => {
    return getScoredRooms(analysisData).map((room) => {
      const status = room.status || getStatus(room)
      return {
        id: room.room_id,
        roomId: room.room_id,
        name: room.room_type,
        direction: room.actual_zone,
        score: room.score,
        maxScore: room.max_score,
        status: status,
        x: room.x,
        y: room.y,
        reason: null, 
      }
    })
  }, [analysisData])

  // 2. State
  const [filter, setFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [hoveredRoomId, setHoveredRoomId] = useState(null)
  
  // Map layers
  const [showDegreeLabels, setShowDegreeLabels] = useState(true)
  const [showDirectionLines, setShowDirectionLines] = useState(true)

  // Map pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isDraggingMap = useRef(false)
  const [isMapDragging, setIsMapDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const mapContainerRef = useRef(null)
  const listRefs = useRef({})
  const setListRef = useCallback((roomId, node) => {
    if (node) listRefs.current[roomId] = node
    else delete listRefs.current[roomId]
  }, [])

  // Focus lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Derived Stats
  const stats = useMemo(() => {
    const counts = { auspicious: 0, inauspicious: 0, unfavourable: 0, neutral: 0 }
    normalizedRooms.forEach(r => counts[r.status]++)
    return counts
  }, [normalizedRooms])

  // Filtering
  const filteredRooms = useMemo(() => {
    return normalizedRooms.filter(r => {
      if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filter === 'All') return true
      if (filter === 'Issues Only') return r.status === 'inauspicious' || r.status === 'unfavourable'
      return r.status.toLowerCase() === filter.toLowerCase()
    })
  }, [normalizedRooms, filter, searchQuery])

  // Map Interaction Handlers
  const handleWheel = (e) => {
    e.preventDefault()
    const zoomSensitivity = 0.001
    const delta = -e.deltaY * zoomSensitivity
    setTransform(prev => {
      let newScale = prev.scale * Math.exp(delta)
      newScale = Math.max(0.5, Math.min(newScale, 4))
      return { ...prev, scale: newScale }
    })
  }

  const handlePointerDown = (e) => {
    isDraggingMap.current = true
    setIsMapDragging(true)
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }
    if (mapContainerRef.current) {
      mapContainerRef.current.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!isDraggingMap.current) return
    const newX = e.clientX - dragStart.current.x
    const newY = e.clientY - dragStart.current.y
    const maxPan = 1000 * transform.scale
    setTransform(prev => ({
      ...prev,
      x: Math.max(-maxPan, Math.min(maxPan, newX)),
      y: Math.max(-maxPan, Math.min(maxPan, newY))
    }))
  }

  const handlePointerUp = (e) => {
    isDraggingMap.current = false
    setIsMapDragging(false)
    if (mapContainerRef.current) {
      mapContainerRef.current.releasePointerCapture(e.pointerId)
    }
  }

  const handleZoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 4) }))
  const handleZoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.5) }))
  const handleReset = () => setTransform({ x: 0, y: 0, scale: 1 })
  const handleFit = () => setTransform({ x: 0, y: 0, scale: 1.2 })

  const handleFocusIssues = () => {
    setFilter('Issues Only')
    const firstIssue = normalizedRooms.find(r => r.status === 'inauspicious' || r.status === 'unfavourable')
    if (firstIssue) {
      handleRoomSelect(firstIssue.id)
    }
  }

  const handleRoomSelect = (id) => {
    setSelectedRoomId(id)
    if (listRefs.current[id]) {
      listRefs.current[id].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const selectedRoom = useMemo(() => normalizedRooms.find(r => r.id === selectedRoomId), [normalizedRooms, selectedRoomId])
  const complianceScore = analysisData?.compliance_percent ?? '--'

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex flex-col" 
      style={{ 
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >
      {/* Header */}
      <header className="h-[72px] bg-white border-b border-[#e5e7eb] px-6 flex items-center justify-between flex-shrink-0 z-30">
        <div>
          <h1 className="text-[22px] font-[700] text-[#0f172a] leading-tight m-0 p-0">Vastu Zone Analysis</h1>
          <p className="text-[13px] text-[#64748b] mt-0.5 font-[500] m-0 p-0">Inspect room placement, direction mapping, and compliance status.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-[600] uppercase tracking-wider text-[#64748b] leading-none mb-1">Compliance</span>
            <span className="text-[18px] font-[800] text-[#0f172a] leading-none">{complianceScore}%</span>
          </div>
          <div className="w-px h-8 bg-[#e5e7eb]"></div>
          <button 
            onClick={onClose}
            className="flex items-center gap-2 h-10 px-4 rounded-[12px] bg-white border border-[#e5e7eb] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-colors font-[600] text-[13px] shadow-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
          >
            <IconClose />
            Close
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden grid grid-cols-[minmax(0,1fr)_clamp(390px,30vw,480px)] max-lg:flex max-lg:flex-col gap-5 p-5">
        
        {/* Left Map Panel */}
        <section className="relative bg-white border border-[#e5e7eb] rounded-[20px] shadow-sm overflow-hidden flex flex-col min-h-0">
          
          {/* Top-Left Toolbar */}
          <div className="absolute top-5 left-5 bg-white border border-[#e5e7eb] rounded-[14px] shadow-sm p-1.5 flex gap-1 z-10">
            <button onClick={handleZoomIn} className="w-10 h-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] rounded-[10px] transition-colors cursor-pointer outline-none focus-visible:bg-[#f8fafc]" title="Zoom In"><IconZoomIn /></button>
            <button onClick={handleZoomOut} className="w-10 h-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] rounded-[10px] transition-colors cursor-pointer outline-none focus-visible:bg-[#f8fafc]" title="Zoom Out"><IconZoomOut /></button>
            <div className="w-px h-6 bg-[#e5e7eb] self-center mx-1" />
            <button onClick={handleFit} className="w-10 h-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] rounded-[10px] transition-colors cursor-pointer outline-none focus-visible:bg-[#f8fafc]" title="Fit to Screen"><IconFit /></button>
            <button onClick={handleReset} className="w-10 h-10 flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] rounded-[10px] transition-colors cursor-pointer outline-none focus-visible:bg-[#f8fafc]" title="Reset View"><IconReset /></button>
          </div>

          {/* Top-Right Layers */}
          <div className="absolute top-5 right-5 bg-white border border-[#e5e7eb] rounded-[14px] shadow-sm p-4 z-10 w-48">
            <h3 className="text-[11px] font-[700] uppercase tracking-wider text-[#64748b] mb-3">Layers</h3>
            <div className="flex flex-col gap-2">
              <Toggle label="Degree Labels" checked={showDegreeLabels} onChange={setShowDegreeLabels} />
              <Toggle label="Grid Lines" checked={showDirectionLines} onChange={setShowDirectionLines} />
            </div>
          </div>

          {/* Bottom-Left Legend */}
          <div className="absolute bottom-5 left-5 bg-white border border-[#e5e7eb] rounded-[14px] shadow-sm py-3 px-4 z-10 flex items-center gap-4">
             <h3 className="text-[11px] font-[700] uppercase tracking-wider text-[#64748b] m-0 pr-2 border-r border-[#e5e7eb]">Legend</h3>
             {['auspicious', 'inauspicious', 'unfavourable', 'neutral'].map(status => {
               const cfg = getStatusConfig(status)
               return (
                 <div key={status} className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                   <span className="text-[12px] font-[600] text-[#0f172a]">{cfg.label}</span>
                 </div>
               )
             })}
          </div>

          {/* Map Viewport Wrapper */}
          <div 
            ref={mapContainerRef}
            className="flex-1 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ padding: '40px', touchAction: 'none' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div 
              style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transition: isMapDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
              }}
            >
              <div style={{ width: 'min(82vh, 68vw)', height: 'min(82vh, 68vw)', pointerEvents: 'none' }}>
                <CompassRose
                  size="100%"
                  northOffset={northOffset}
                  floorPlanImg={analysisData?.floor_plan_img || ''}
                  roomDots={normalizedRooms.map(r => ({ ...r, roomId: r.id }))}
                  selectedRoomId={selectedRoomId}
                  hoveredRoomId={hoveredRoomId}
                  onRoomHover={setHoveredRoomId}
                  onRoomClick={handleRoomSelect}
                  drawingBounds={drawingBounds}
                  imageExtent={imageExtent}
                  interactive={false}
                  showDegreeLabels={showDegreeLabels}
                  showDirectionLines={showDirectionLines}
                  showMarkers={true}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Inspector Panel */}
        <aside className="bg-white border border-[#e5e7eb] rounded-[20px] shadow-sm h-full flex flex-col overflow-hidden z-20">
          
          <div className="p-5 flex-shrink-0 flex flex-col">
            
            {/* Top Summary Section */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-[14px] p-4 flex flex-col justify-center min-h-[76px]">
                <span className="text-[11px] font-[700] uppercase tracking-wider text-[#64748b]">Total Rooms</span>
                <span className="text-[22px] font-[800] text-[#0f172a] leading-none mt-1">{normalizedRooms.length}</span>
              </div>
              <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-[14px] p-4 flex flex-col justify-center min-h-[76px]">
                <span className="text-[11px] font-[700] uppercase tracking-wider text-[#ea580c]">Issues Found</span>
                <span className="text-[22px] font-[800] text-[#ea580c] leading-none mt-1">{stats.inauspicious + stats.unfavourable}</span>
              </div>
            </div>

            {/* Search & Focus */}
            <div className="mt-4 flex flex-col gap-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]"><IconSearch /></span>
                <input 
                  type="text" 
                  placeholder="Search rooms..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-[42px] w-full rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] px-4 pl-[38px] text-[14px] font-[500] focus:outline-none focus:border-[#f97316] focus:bg-white focus:ring-1 focus:ring-[#f97316] transition-all text-[#0f172a] placeholder-[#64748b]"
                />
              </div>
              <button 
                onClick={handleFocusIssues}
                className="h-[42px] w-full bg-[#fff7ed] text-[#ea580c] hover:bg-[#ffedd5] border border-[#fed7aa] rounded-[12px] flex items-center justify-center gap-2 font-[600] text-[13px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]"
                title="Focus on Inauspicious & Unfavourable rooms"
              >
                <IconFocus /> Focus Issues
              </button>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap gap-2">
              {['All', 'Issues Only', 'Auspicious', 'Neutral', 'Inauspicious', 'Unfavourable'].map(f => {
                const isActive = filter === f
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`h-[30px] px-3 rounded-full flex items-center text-[12px] font-[600] transition-colors border cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a] ${
                      isActive 
                        ? 'bg-[#0f172a] text-white border-[#0f172a]' 
                        : 'bg-white text-[#64748b] border-[#e5e7eb] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                    }`}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Room Details */}
          <div className="px-5 pb-3 flex-shrink-0">
            <div className="border border-[#e5e7eb] rounded-[16px] bg-white shadow-sm overflow-hidden flex flex-col min-h-[120px]">
              {selectedRoom ? (
                <>
                  <div className="bg-[#f8fafc] p-4 border-b border-[#e5e7eb] flex items-start justify-between">
                    <div>
                      <h4 className="text-[11px] font-[700] uppercase tracking-wider text-[#64748b] mb-1">Selected Room</h4>
                      <h3 className="text-[16px] font-[700] text-[#0f172a] leading-tight">{selectedRoom.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[12px] font-[600] text-[#64748b] bg-white border border-[#e5e7eb] px-2 py-0.5 rounded-md">
                          {selectedRoom.direction}
                        </span>
                        <span 
                          className="text-[11px] font-[700] px-2 py-0.5 rounded-md border"
                          style={{ 
                            color: getStatusConfig(selectedRoom.status).color, 
                            backgroundColor: getStatusConfig(selectedRoom.status).bg, 
                            borderColor: getStatusConfig(selectedRoom.status).border 
                          }}
                        >
                          {getStatusConfig(selectedRoom.status).label}
                        </span>
                      </div>
                    </div>
                    {selectedRoom.maxScore > 0 && (
                      <div className="text-right">
                        <span className="text-[22px] font-[800] leading-none block" style={{ color: getStatusConfig(selectedRoom.status).color }}>
                          {selectedRoom.score}
                        </span>
                        <span className="text-[12px] text-[#64748b] font-[600]">/ {selectedRoom.maxScore}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] text-[#475569] leading-relaxed font-[500]">
                      {selectedRoom.reason ? selectedRoom.reason : "Detailed explanation is not available for this room."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#f8fafc]">
                  <span className="text-[13px] font-[500] text-[#64748b]">Select a room from the map or list to view details.</span>
                </div>
              )}
            </div>
          </div>

          {/* Room List (Scrollable) */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
            {filteredRooms.length === 0 ? (
              <div className="py-10 text-center text-[#64748b] text-[13px] font-[500]">
                No rooms match the current filters.
              </div>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {filteredRooms.map(room => {
                  const isSelected = room.id === selectedRoomId
                  const isHovered = room.id === hoveredRoomId
                  const cfg = getStatusConfig(room.status)
                  
                  return (
                    <button
                      key={room.id}
                      ref={(node) => setListRef(room.id, node)}
                      onClick={() => handleRoomSelect(room.id)}
                      onMouseEnter={() => setHoveredRoomId(room.id)}
                      onMouseLeave={() => setHoveredRoomId(null)}
                      className={`w-full text-left p-[12px_14px] rounded-[14px] border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] ${
                        isSelected 
                          ? 'bg-[#fff7ed] border-[#f97316] shadow-sm' 
                          : isHovered
                            ? 'bg-[#f8fafc] border-[#cbd5e1]'
                            : 'bg-white border-[#e5e7eb] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <div className="flex items-center justify-between min-w-0 gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[14px] font-[600] text-[#0f172a] truncate leading-snug">{room.name}</span>
                          <span className="text-[12px] font-[500] text-[#64748b] mt-0.5 truncate">{room.direction}</span>
                        </div>
                        <span 
                          className="flex-shrink-0 inline-flex items-center justify-center text-[11px] font-[700] px-2 py-1 rounded-md border"
                          style={{ 
                            color: cfg.color, 
                            backgroundColor: cfg.bg, 
                            borderColor: cfg.border 
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>,
    document.body
  )
}
