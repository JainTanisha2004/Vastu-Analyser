import React, { useMemo, useRef, useState } from 'react'
import CompassRose from './CompassRose'
import { getRoomStatus } from '../utils/roomStatus'
import { downloadElementAsPdf } from '../utils/exportPdf'
import { getScoredRooms } from '../utils/analysisInput'

function getVastuDetails(roomType, zone, status) {
  if (status === 'auspicious') {
    return {
      strength: `${roomType} in ${zone} is highly favorable`,
      issue: null,
      recommendation: `No major corrections needed for the ${roomType}.`
    }
  }
  if (status === 'neutral') {
    return {
      strength: `${roomType} in ${zone} is acceptable`,
      issue: null,
      recommendation: `No actions required.`
    }
  }

  const config = {
    "Kitchen": {
      "NE": {
        issue: "Kitchen in North-East (Water-Fire conflict)",
        recommendation: "Severe clash. Place a yellow strip around the cooktop, and avoid red/black colors."
      },
      "N": {
        issue: "Kitchen in North (Water zone conflict)",
        recommendation: "Financial strain. Place a green stone slab under the burner."
      },
      default: {
        issue: `Kitchen in ${zone} (suboptimal)`,
        recommendation: "Position the cooktop in the South-East corner of the kitchen area."
      }
    },
    "Toilet": {
      "NE": {
        issue: "Toilet in North-East (Severe energy drain)",
        recommendation: "Place a bowl of raw sea salt inside, keep toilet door closed, install a copper helix."
      },
      "SE": {
        issue: "Toilet in South-East (Fire zone conflict)",
        recommendation: "Affects liquid cash. Paint the toilet door peach and insert a copper strip."
      },
      default: {
        issue: `Toilet in ${zone} (suboptimal)`,
        recommendation: "Keep the area highly ventilated and place a bowl of Vastu salt."
      }
    },
    "Master Bedroom": {
      "NE": {
        issue: "Master Bed in North-East (Sleep issues)",
        recommendation: "Sleep with headboard facing South or East. Avoid blue/gray colors."
      },
      default: {
        issue: `Master Bed in ${zone} (suboptimal)`,
        recommendation: "Align the headboard against the South or East wall. Avoid mirror facing bed."
      }
    },
    "Main Door": {
      "SW": {
        issue: "Entrance in South-West (Energy instability)",
        recommendation: "Major Vastu defect. Install a lead metal strip on the door threshold."
      },
      default: {
        issue: `Entrance in ${zone} (suboptimal)`,
        recommendation: "Decorate the entrance threshold with auspicious symbols (Om/Swastika) and keep it well lit."
      }
    }
  }

  const roomConfig = config[roomType]
  if (roomConfig) {
    const zoneConfig = roomConfig[zone] || roomConfig.default
    return { strength: null, ...zoneConfig }
  }

  return {
    strength: null,
    issue: `${roomType} in ${zone} is suboptimal`,
    recommendation: `Paint ${roomType} in light element colors (e.g. green for NE/E, yellow for SW).`
  }
}

export default function VastuReportPreview({
  analysisData,
  floorPlanImg,
  northOffset,
  drawingBounds,
  imageExtent,
  filename = '',
  onClose,
}) {
  const sheetRef = useRef(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const { compliance_percent } = analysisData || {}
  const scoredRooms = getScoredRooms(analysisData)

  // 1. Precalculate room data (centroid coordinates + status). The CompassRose
  //    overlay derives its own full room-name labels, so no short codes here.
  const processedRooms = useMemo(() => {
    return scoredRooms.map((room) => {
      return {
        ...room,
        roomId: room.room_id,
        x: room.x ?? 0,
        y: room.y ?? 0,
        roomType: room.room_type,
        status: room.status || getRoomStatus(room),
      }
    })
  }, [scoredRooms])

  // 2. Count room statuses for summary
  const counts = useMemo(() => {
    const counts = { favorable: 0, suboptimal: 0, unfavorable: 0, neutral: 0 }
    processedRooms.forEach(r => {
      if (r.status === 'auspicious') counts.favorable++
      else if (r.status === 'inauspicious') counts.suboptimal++
      else if (r.status === 'unfavourable') counts.unfavorable++
      else counts.neutral++
    })
    return counts
  }, [processedRooms])

  // 3. Compile Vastu strengths, concerns, and recommendations
  const reportLists = useMemo(() => {
    const strengths = []
    const concerns = []
    const recommendations = []

    processedRooms.forEach(room => {
      const details = getVastuDetails(room.roomType, room.actual_zone, room.status)
      if (room.status === 'auspicious') {
        strengths.push(`${room.roomType} in ${room.actual_zone} is favorable`)
      } else if (room.status === 'unfavourable') {
        concerns.push(`${room.roomType} in ${room.actual_zone}`)
        recommendations.push(details.recommendation)
      } else if (room.status === 'inauspicious') {
        concerns.push(`${room.roomType} in ${room.actual_zone} - Moderate`)
        recommendations.push(details.recommendation)
      }
    })

    // Add general fallback recommendations if lists are short
    if (recommendations.length < 3) {
      recommendations.push("Ensure home center (Brahmasthan) is kept clean, light, and free of heavy furniture.")
      recommendations.push("Position mirrors only on North or East walls to reflect positive energies.")
    }

    return {
      strengths: strengths.slice(0, 4),
      concerns: concerns.slice(0, 3),
      recommendations: recommendations.slice(0, 4)
    }
  }, [processedRooms])

  // Early return placed AFTER all hooks to satisfy the rules of hooks.
  if (!analysisData) return null

  const dateStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  const complianceLabel = compliance_percent >= 70 ? 'Good' : compliance_percent >= 45 ? 'Moderate' : 'Poor'

  const safeName = (filename || 'vastu').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_') || 'vastu'

  const handleDownloadPdf = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      await downloadElementAsPdf(sheetRef.current, `${safeName}-vastu-report.pdf`)
    } catch (err) {
      console.error('PDF export failed, falling back to print:', err)
      window.print()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f1f5f9] flex flex-col overflow-y-auto">
      {/* Top action bar (screen only) */}
      <div className="print-preview-top-bar sticky top-0 bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between shadow-md z-50">
        <div>
          <h2 className="text-sm font-bold text-slate-300">Vastu PDF Report</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Preview report layout on standard A4 landscape sheet.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            ← Back to Wizard
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 ${isDownloading ? 'bg-slate-600 cursor-wait' : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 cursor-pointer'}`}
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin-slow w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                Preparing…
              </>
            ) : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Main A4 sheet preview area */}
      <div className="flex-1 flex justify-center items-start py-8 px-4 bg-slate-100">
        <div
          ref={sheetRef}
          className="print-report-container screen-preview bg-white border border-slate-300 rounded-[8px] shadow-2xl p-6 flex flex-col justify-between"
          style={{ width: '297mm', height: '210mm', minHeight: '210mm', boxSizing: 'border-box' }}
        >
          {/* Header Block */}
          <div className="w-full flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polygon points="12,2 14,9 22,12 14,15 12,22 10,15 2,12 10,9" fill="#ea580c" fillOpacity="0.1"/></svg>
              </div>
              <div>
                <h1 className="text-[17px] font-black text-slate-900 tracking-tight leading-none uppercase">Vastu Analysis Report</h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Home Floor Plan Analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <div className="flex flex-col">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Project Name:</span>
                  <span className="text-[11px] font-bold text-slate-700 leading-none mt-0.5">{filename || 'Vastu Project'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div className="flex flex-col">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Date Generated:</span>
                  <span className="text-[11px] font-bold text-slate-700 leading-none mt-0.5">{dateStr}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200" />

              <div className="flex items-center gap-2">
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Overall Compliance Score</span>
                  <span className="text-[11px] font-black text-slate-500 mt-0.5 leading-none">
                    <span className="text-[15px] text-green-600 font-extrabold">{compliance_percent}%</span> {complianceLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Body Block */}
          <div className="flex-1 flex gap-5 items-stretch min-h-0 py-1">
            {/* Map Area (78% width) */}
            <div className="w-[78%] flex flex-col justify-center items-center relative border border-slate-200 rounded-2xl bg-white p-2">
              <div className="w-[430px] h-[430px] flex items-center justify-center">
                <CompassRose
                  size="100%"
                  northOffset={northOffset}
                  floorPlanImg={floorPlanImg}
                  roomDots={processedRooms}
                  drawingBounds={drawingBounds}
                  imageExtent={imageExtent}
                  interactive={false}
                  showDegreeLabels={true}
                  showDirectionLines={true}
                  showMarkers={true}
                  showRoomLabels={true}
                  enlarged={true}
                  enlargedPrint={true} // enables the unclipped, precise custom scaled printing map
                />
              </div>
            </div>

            {/* Sidebar Details (22% width) */}
            <div className="w-[22%] flex flex-col gap-3 justify-between">
              {/* Status Legend */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <h3 className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 leading-none">Status Legend</h3>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#16A34A' }} />
                    <span>Favorable / Auspicious</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#EA580C' }} />
                    <span>Suboptimal / Acceptable</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#DC2626' }} />
                    <span>Unfavorable / Conflict</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#78716C' }} />
                    <span>Neutral / Not Evaluated</span>
                  </div>
                </div>
              </div>

              {/* Summary Table */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40">
                <h3 className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 leading-none">Summary</h3>
                <div className="flex flex-col gap-1.5 text-[10px] font-bold text-slate-600">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#16A34A] rounded-sm flex-shrink-0" />
                      <span>Favorable</span>
                    </div>
                    <span className="text-slate-800">{counts.favorable}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#EA580C] rounded-sm flex-shrink-0" />
                      <span>Suboptimal</span>
                    </div>
                    <span className="text-slate-800">{counts.suboptimal}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#DC2626] rounded-sm flex-shrink-0" />
                      <span>Unfavorable</span>
                    </div>
                    <span className="text-slate-800">{counts.unfavorable}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#78716C] rounded-sm flex-shrink-0" />
                      <span>Neutral</span>
                    </div>
                    <span className="text-slate-800">{counts.neutral}</span>
                  </div>
                  <div className="h-px bg-slate-200 my-0.5" />
                  <div className="flex justify-between items-center text-slate-800 font-extrabold text-[10.5px]">
                    <span>Total Rooms</span>
                    <span>{scoredRooms.length}</span>
                  </div>
                </div>
              </div>

              {/* Top Vastu Strengths */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/30 flex-shrink-0">
                <h3 className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 leading-none">Top Vastu Strengths</h3>
                {reportLists.strengths.length === 0 ? (
                  <p className="text-[9.5px] text-slate-400">No favorable placements found.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {reportLists.strengths.map((s, idx) => (
                      <li key={idx} className="flex gap-1.5 text-[9.5px] text-slate-600 font-bold leading-tight items-start">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-0.5"><circle cx="6" cy="6" r="6" fill="#16A34A"/><path d="M3.5 6l1.7 1.7 3.3-3.4" stroke="white" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span className="flex-1">{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
 
              {/* Key Vastu Concerns */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/20 flex-shrink-0">
                <h3 className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 leading-none">Key Vastu Concerns</h3>
                {reportLists.concerns.length === 0 ? (
                  <p className="text-[9.5px] text-slate-400">No negative placements detected.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {reportLists.concerns.map((c, idx) => (
                      <li key={idx} className="flex gap-1.5 text-[9.5px] text-slate-600 font-bold leading-tight items-start">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-0.5"><circle cx="6" cy="6" r="6" fill="#DC2626"/><path d="M6 3.5v3M6 8.5h.01" stroke="white" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span className="flex-1">{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
 
              {/* Recommendations */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/10 flex-shrink-0">
                <h3 className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 leading-none">Recommendations</h3>
                <ul className="flex flex-col gap-1.5">
                  {reportLists.recommendations.slice(0, 3).map((r, idx) => (
                    <li key={idx} className="flex gap-1.5 text-[9.5px] text-slate-600 font-bold leading-tight items-start">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-0.5"><circle cx="6" cy="6" r="6" fill="#0284C7"/><path d="M4 6h4M6 4l2 2-2 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <span className="flex-1">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Footer Block */}
          <div className="w-full flex items-center justify-between border-t border-slate-200 pt-3 mt-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold leading-none">
              <span className="text-[#0284c7] font-bold">ℹ</span>
              <span>The floor plan is oriented with North at the top (0°). Directions are calculated based on this orientation.</span>
            </div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
              Note: Vastu results are based on general principles. Actual results may vary.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
