import React, { useState } from 'react'
import CompassRose from './CompassRose'
import VastuMapAnalysisView from './VastuMapAnalysisView'
import VastuReportPreview from './VastuReportPreview'
import AIReportView from './AIReportView'
import { generateAIReport } from '../api/reportApi'
import { getRoomStatus as getStatus, statusColor } from '../utils/roomStatus'
import { getScoredRooms } from '../utils/analysisInput'

function StatusBadge({ status }) {
  const cfg = {
    auspicious: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Auspicious' },
    inauspicious: { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', label: 'Inauspicious' },
    unfavourable: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Unfavourable' },
    neutral: { color: '#78716C', bg: '#F5F5F4', border: '#E7E5E4', label: 'Neutral' },
  }
  const c = cfg[status]
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  )
}

export default function ReportStep({
  analysisData,
  isLoading = false,
  error = null,
  floorPlanImg,
  northOffset,
  drawingBounds,
  imageExtent,
  rooms,
  originalRooms = [],
  filename = '',
  onRetry,
  onStartOver,
  onBack,
}) {
  const [hoveredRoomIndex, setHoveredRoomIndex] = useState(null)
  const [showOptimized, setShowOptimized] = useState(false)
  const [isEnlarged, setIsEnlarged] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAIReport, setShowAIReport] = useState(false)
  const [aiReportData, setAiReportData] = useState(null)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiReportError, setAiReportError] = useState(null)

  const handleOpenAIReport = async () => {
    setShowAIReport(true)
    if (!aiReportData && !isGeneratingAI) {
      setIsGeneratingAI(true)
      setAiReportError(null)
      try {
        const data = await generateAIReport(analysisData, analysisData?.file_id)
        setAiReportData(data)
      } catch (err) {
        setAiReportError(err.message || 'Failed to generate AI report')
      } finally {
        setIsGeneratingAI(false)
      }
    }
  }

  if (!analysisData) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-4 animate-fadeSlideIn px-6">
        {isLoading ? (
          <>
            <svg className="animate-spin-slow w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            <p className="text-stone-400 text-sm font-medium">Generating your Vaastu report…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-stone-700 font-bold text-[15px]">We couldn't generate your report</h3>
              <p className="text-stone-400 text-[13px] mt-1 max-w-sm">{error || 'Something went wrong while analysing your plan.'}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-1 px-5 h-10 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                Try Again
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  const {
    rows,
    compliance_percent,
    optimization,
    optimized_zone_map_img,
    floor_plan_img,
    zone_map_img,
  } = analysisData

  const hasOptimization = optimization && optimization.move && optimization.improvement > 0
  const scoredRooms = getScoredRooms(analysisData)
  const analysisWarnings = Array.isArray(analysisData.warnings) ? analysisData.warnings : []

  // Build room dots for the static compass rose
  const roomDots = scoredRooms.map((room) => ({
    roomId: room.room_id,
    x: room.x,
    y: room.y,
    type: room.room_type,
    score: room.score,
    maxScore: room.max_score,
    zone: room.actual_zone,
    status: room.status || getStatus(room),
  }))

  const barColor = (row) => statusColor(getStatus(row))

  const renderTable = () => (
    <table className="w-full text-sm table-fixed">
      <thead className="sticky top-0 bg-stone-50 z-10">
        <tr className="text-stone-400 text-[10px] uppercase tracking-widest font-bold">
          <th className="text-left px-3 py-3 w-[3%]"></th>
          <th className="text-left px-2 py-3 w-[29%]">Room</th>
          <th className="text-left px-2 py-3 w-[16%]">Direction</th>
          <th className="text-right px-3 py-3 w-[14%]">Points</th>
          <th className="text-right px-3 py-3 w-[12%]">Max</th>
          <th className="text-left px-3 py-3 w-[26%]">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const status = getStatus(row)
          const isHovered = hoveredRoomIndex === i
          return (
            <tr
              key={row.room_id}
              className={`border-t border-stone-50 transition-all duration-150 cursor-pointer ${isHovered ? 'bg-orange-50/60' : ''}`}
              onMouseEnter={() => setHoveredRoomIndex(i)}
              onMouseLeave={() => setHoveredRoomIndex(null)}
            >
              <td className="px-0 py-2.5">
                <div className="w-[3px] h-7 rounded-r-full ml-0.5" style={{ backgroundColor: barColor(row) }} />
              </td>
              <td className="px-2 py-2.5 font-bold text-stone-700 text-[13px] truncate">{row.room_type}</td>
              <td className="px-2 py-2.5 text-stone-400 text-[13px] font-medium">{row.actual_zone}</td>
              <td
                className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums"
                style={{ color: row.score < 0 ? '#DC2626' : '#44403C' }}
              >
                {Number(row.score).toFixed(1)}
              </td>
              <td className="px-3 py-2.5 text-right text-[13px] font-medium text-stone-400 tabular-nums">
                {Number(row.max_score ?? 0).toFixed(1)}
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={status} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className="flex flex-col h-full animate-fadeSlideIn overflow-y-auto lg:overflow-visible">
      {analysisWarnings.length > 0 && (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex-shrink-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 mb-1">Analysis notes</p>
          <ul className="space-y-0.5">
            {analysisWarnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`} className="text-[12px] font-semibold text-amber-800">
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Main content: compass + table */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
        {/* LEFT: Compass */}
        <div className="w-full lg:w-[52%] flex items-center justify-center relative group">
          <div style={{ width: 'min(80vw, 360px)', maxWidth: '360px', aspectRatio: '1 / 1' }}>
            <CompassRose
              size="100%"
              northOffset={northOffset}
              floorPlanImg={floor_plan_img || floorPlanImg}
              roomDots={roomDots}
              hoveredRoomIndex={hoveredRoomIndex}
              onRoomHover={setHoveredRoomIndex}
              drawingBounds={drawingBounds}
              imageExtent={imageExtent}
              interactive={false}
            />
          </div>
          <button 
             onClick={() => setIsEnlarged(true)}
             className="absolute top-0 right-0 bg-white/90 shadow-sm border border-stone-200 px-2.5 py-1.5 rounded-xl text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-all z-10 cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
             title="Enlarge Map View"
          >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
             Enlarge View
          </button>
        </div>

        {/* RIGHT: Table */}
        <div className="w-full lg:w-[48%] flex flex-col min-h-[320px] lg:min-h-0">
          <div className="flex-1 overflow-y-auto border border-stone-100 rounded-2xl">
            {renderTable()}
          </div>

          {/* Score bar */}
          <div className="mt-4 flex items-center gap-3 px-1">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Compliance</span>
            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${compliance_percent}%`,
                  backgroundColor: compliance_percent >= 70 ? '#16A34A' : compliance_percent >= 40 ? '#EAB308' : '#DC2626',
                }}
              />
            </div>
            <span className="text-sm font-extrabold text-stone-800">{compliance_percent}%</span>
          </div>

          {/* Print Report button */}
          <button
            onClick={() => setShowPreview(true)}
            className="mt-6 w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group animate-fadeSlideIn"
          >
            <svg
              className="w-5 h-5 text-white/90 group-hover:scale-110 transition-transform duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Vastu Report
          </button>

          {/* ✨ Generate AI Detailed Report button */}
          <button
            onClick={handleOpenAIReport}
            className="mt-3 w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group animate-fadeSlideIn"
          >
            <span className="text-base group-hover:scale-125 transition-transform duration-200">✨</span>
            Generate AI Detailed Report
          </button>

          {/* Back to Edit button */}
          {onBack && (
            <button
              onClick={onBack}
              className="mt-3 w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group animate-fadeSlideIn border border-stone-200"
            >
              <svg
                className="w-4 h-4 text-stone-500 group-hover:-translate-x-0.5 transition-transform duration-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Modify Layout / Go Back
            </button>
          )}

          {/* Start Over button */}
          {onStartOver && (
            <button
              onClick={onStartOver}
              className="mt-3 w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group animate-fadeSlideIn border border-stone-200"
            >
              <svg
                className="w-4 h-4 text-stone-500 group-hover:-rotate-45 transition-transform duration-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Upload New Floor Plan
            </button>
          )}
        </div>
      </div>

      {/* ── Optimization Section ── */}
      {optimization && (
        <div className="mt-5 pt-4 border-t border-stone-100">
          <h3 className="playfair text-[15px] font-bold text-stone-800 mb-3 tracking-tight">
            Layout Optimization
          </h3>

          {/* Score comparison bar */}
          <div
            className="flex items-center gap-4 bg-gradient-to-r from-stone-50 to-orange-50/40 border border-stone-100 rounded-2xl px-5 py-4 mb-4"
            style={{ animation: 'fadeSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards' }}
          >
            {/* Original score */}
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Current</span>
              <span className="text-2xl font-extrabold text-stone-700">{optimization.original_score}%</span>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-stone-200 to-orange-300 rounded-full" />
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                <path d="M4 10h12M12 6l4 4-4 4" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-orange-300 to-green-300 rounded-full" />
            </div>

            {/* Optimized score */}
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Optimized</span>
              <span className="text-2xl font-extrabold" style={{ color: optimization.improvement > 0 ? '#16A34A' : '#78716C' }}>
                {optimization.optimized_score}%
              </span>
            </div>

            {/* Improvement badge */}
            {optimization.improvement > 0 && (
              <div className="flex flex-col items-center min-w-[60px]">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1.5 rounded-full"
                  style={{ color: '#16A34A', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 9V3M6 3L3 6M6 3l3 3" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  +{optimization.improvement}%
                </span>
              </div>
            )}
          </div>

          {/* Recommended move card */}
          {hasOptimization && (
            <div
              className="bg-white border border-orange-100 rounded-2xl px-5 py-4 mb-4 shadow-sm"
              style={{ animation: 'fadeSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards 0.1s', opacity: 0 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 12l4-4 4 4M4 8l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-stone-800 mb-1">Recommended Change</p>
                  {optimization.move.type === 'swap' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                        {optimization.move.room_a}
                      </span>
                      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" className="flex-shrink-0">
                        <path d="M1 4h14M12 1l3 3-3 3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 10H5M8 13l-3-3 3-3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                        {optimization.move.room_b}
                      </span>
                      <span className="text-stone-400 text-[12px] ml-1">swap positions</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                        {optimization.move.room_a}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2 7h10M9 4l3 3-3 3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                        {optimization.move.room_b}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2 7h10M9 4l3 3-3 3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                        {optimization.move.room_c}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2 7h10M9 4l3 3-3 3" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                      </svg>
                      <span className="text-stone-400 text-[12px]">cycle swap</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No improvement message */}
          {!hasOptimization && (
            <div className="flex items-center gap-3 bg-stone-50/60 border border-stone-100 rounded-2xl px-5 py-4 mb-4">
              <p className="text-stone-600 text-[13px] leading-relaxed">
                {compliance_percent >= 60
                  ? `Your layout scores ${compliance_percent}% — well optimized. No beneficial room swaps were found.`
                  : `No compatible room swaps found. Rooms may differ in size class, preventing valid swaps.`}
              </p>
            </div>
          )}

          {/* Optimized Map Toggle + Image */}
          {hasOptimization && optimized_zone_map_img && (
            <div>
              {/* Toggle buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setShowOptimized(false)}
                  className={`px-4 py-2 text-[12px] font-bold rounded-xl transition-all cursor-pointer ${!showOptimized
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                >
                  Current Layout
                </button>
                <button
                  onClick={() => setShowOptimized(true)}
                  className={`px-4 py-2 text-[12px] font-bold rounded-xl transition-all cursor-pointer ${showOptimized
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                >
                  Optimized Layout
                </button>
              </div>

              {/* Map HTML Title */}
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                {showOptimized ? 'Optimized Vastu Zone Map' : `Vastu Zone Map — Compliance: ${compliance_percent}%`}
              </p>

              {/* Map image */}
              <div
                className="relative rounded-2xl overflow-hidden border border-stone-100 shadow-sm"
                style={{ animation: 'fadeSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards' }}
              >
                {/* Score label overlay */}
                <div className="absolute top-3 right-3 z-10">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full backdrop-blur-sm"
                    style={{
                      color: showOptimized ? '#16A34A' : '#EA580C',
                      backgroundColor: showOptimized ? 'rgba(240,253,244,0.9)' : 'rgba(255,247,237,0.9)',
                      border: `1px solid ${showOptimized ? '#BBF7D0' : '#FED7AA'}`,
                    }}
                  >
                    {showOptimized ? `${optimization.optimized_score}%` : `${optimization.original_score}%`}
                  </span>
                </div>

                <img
                  src={`data:image/png;base64,${showOptimized ? optimized_zone_map_img : (zone_map_img || '')}`}
                  alt={showOptimized ? 'Optimized Vastu Zone Map' : 'Current Vastu Zone Map'}
                  className="w-full h-auto"
                  style={{ maxHeight: '360px', objectFit: 'contain', backgroundColor: '#1a1a2e' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enlarged View Fullscreen Dashboard */}
      {isEnlarged && (
        <VastuMapAnalysisView
          analysisData={analysisData}
          northOffset={northOffset}
          drawingBounds={drawingBounds}
          imageExtent={imageExtent}
          onClose={() => setIsEnlarged(false)}
        />
      )}

      {/* ── VASTU REPORT PREVIEW MODAL ── */}
      {showPreview && (
        <VastuReportPreview
          analysisData={analysisData}
          floorPlanImg={floor_plan_img || floorPlanImg}
          northOffset={northOffset}
          drawingBounds={drawingBounds}
          imageExtent={imageExtent}
          rooms={rooms}
          originalRooms={originalRooms}
          filename={filename}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── AI DETAILED REPORT MODAL ── */}
      {showAIReport && (
        <AIReportView
          reportData={aiReportData}
          analysisData={analysisData}
          isLoading={isGeneratingAI}
          error={aiReportError}
          filename={filename}
          fileId={analysisData?.file_id}
          onClose={() => setShowAIReport(false)}
          onRegenerate={() => {
            setAiReportData(null)
            setIsGeneratingAI(true)
            setAiReportError(null)
            generateAIReport(analysisData, analysisData?.file_id)
              .then(setAiReportData)
              .catch((err) => setAiReportError(err.message || 'Failed to generate AI report'))
              .finally(() => setIsGeneratingAI(false))
          }}
        />
      )}
    </div>
  )
}
