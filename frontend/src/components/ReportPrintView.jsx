import React from 'react'
import CompassRose from './CompassRose'
import { getScoredRooms } from '../utils/analysisInput'

const IDEAL_ZONES = {
  "Kitchen": "SE (Preferred), S, E",
  "Main Door": "NE, N, E",
  "Foyer": "NE, N, E",
  "Master Bedroom": "SW (Preferred), S, W",
  "Toilet": "NW, W (Preferred), S",
  "Mandir": "NE (Preferred), E, N",
  "Staircase": "SW, S, W",
  "Living": "N, E, NE",
  "Dining": "W, N, E",
  "Kids Bedroom": "NW, NE, E",
  "Guest": "NW, NE, E",
  "Elders Bedroom": "SW, S, W",
  "Wash": "SE, NW, E",
  "Balcony": "N, E, NE",
  "Generic Room": "Any"
}

function getStatus(row) {
  if (row.score < 0) return 'unfavourable'
  if (row.max_score === 0 && row.score === 0) return 'neutral'
  if (row.max_score > 0 && row.score / row.max_score >= 0.5) return 'auspicious'
  return 'inauspicious'
}

function getStatusLabel(status) {
  const cfg = {
    auspicious: 'Favorable',
    inauspicious: 'Suboptimal',
    unfavourable: 'Unfavorable',
    neutral: 'Neutral',
  }
  return cfg[status] || 'Neutral'
}

function getStatusColor(status) {
  const cfg = {
    auspicious: '#16A34A', // Green
    inauspicious: '#EA580C', // Orange
    unfavourable: '#DC2626', // Red
    neutral: '#78716C', // Gray
  }
  return cfg[status] || '#78716C'
}

function getStatusBg(status) {
  const cfg = {
    auspicious: '#F0FDF4',
    inauspicious: '#FFF7ED',
    unfavourable: '#FEF2F2',
    neutral: '#F5F5F4',
  }
  return cfg[status] || '#F5F5F4'
}

function getStatusBorder(status) {
  const cfg = {
    auspicious: '#BBF7D0',
    inauspicious: '#FED7AA',
    unfavourable: '#FECACA',
    neutral: '#E7E5E4',
  }
  return cfg[status] || '#E7E5E4'
}

function getVastuDetails(roomType, zone, status) {
  if (status === 'auspicious') {
    return {
      issue: 'Correctly placed',
      recommendation: 'No major correction needed. Keep the zone clean and well-lit.'
    }
  }
  if (status === 'neutral') {
    return {
      issue: 'Acceptable placement',
      recommendation: 'No major correction needed.'
    }
  }
  
  const config = {
    "Kitchen": {
      "NE": {
        issue: "Kitchen in NE (fire & water conflict)",
        recommendation: "Severe element conflict. Place a yellow strip around the burner, avoid red decor, and install a brass helix."
      },
      "N": {
        issue: "Kitchen in North (water zone conflict)",
        recommendation: "Financial strain. Place a green stone slab under the burner, avoid black/blue granite."
      },
      default: {
        issue: `Kitchen in ${zone} (suboptimal)`,
        recommendation: "Preferably place cooktop in the SE corner of the kitchen. Keep the wall colors light pastel or peach."
      }
    },
    "Toilet": {
      "NE": {
        issue: "Toilet in NE (severe energy drain)",
        recommendation: "Highly detrimental to health/harmony. Place a bowl of raw sea salt inside, keep door closed, and install copper/brass helix."
      },
      "SE": {
        issue: "Toilet in SE (fire zone conflict)",
        recommendation: "Affects cash flow. Paint the door peach/light orange and place a copper strip under the threshold."
      },
      default: {
        issue: `Toilet in ${zone} (suboptimal)`,
        recommendation: "Keep the area ventilated, place a bowl of Vastu salt, and paint in light neutral shades (white/off-white)."
      }
    },
    "Master Bedroom": {
      "NE": {
        issue: "Master Bed in NE (instability)",
        recommendation: "Causes sleep issues. Position bed headboard South or East, paint room light yellow/white, place lead Swastika in SW."
      },
      default: {
        issue: `Master Bed in ${zone} (suboptimal)`,
        recommendation: "Ensure headboard is placed against the South or East wall. Avoid mirrors facing the bed."
      }
    },
    "Main Door": {
      "SW": {
        issue: "Entrance in SW (instability)",
        recommendation: "Major Vastu defect. Install a lead metal strip on the threshold and place a Vastu pyramid above the door."
      },
      default: {
        issue: `Entrance in ${zone} (suboptimal)`,
        recommendation: "Decorate the entrance with auspicious symbols (Swastika, Om), keep it well-lit, and place yellow flowers/plants near the door."
      }
    },
    "Foyer": {
      "SW": {
        issue: "Foyer in SW (energy leak)",
        recommendation: "Place lead Vastu pyramids to stabilize entrance energies."
      },
      default: {
        issue: `Foyer in ${zone} (suboptimal)`,
        recommendation: "Keep it clean, well-lit, and place a green plant or water fountain in the north corner."
      }
    },
    "Mandir": {
      "S": {
        issue: "Mandir in South (spiritual clash)",
        recommendation: "Relocate the altar to the NE corner if possible. Avoid black/red colors, use yellow or cream tones."
      },
      "SW": {
        issue: "Mandir in SW (energy blockages)",
        recommendation: "Relocate the altar to NE, N, or E. Paint the mandir area yellow."
      },
      default: {
        issue: `Mandir in ${zone} (suboptimal)`,
        recommendation: "Ensure worshippers face East or North. Keep the mandir clean and uncluttered."
      }
    },
    "Staircase": {
      "NE": {
        issue: "Staircase in NE (heavy weight blocking flow)",
        recommendation: "Blocks positive morning energies. Place a copper Swastika under the first step and paint stairs light cream."
      },
      default: {
        issue: `Staircase in ${zone} (suboptimal)`,
        recommendation: "Keep the underneath area of stairs free of junk. Paint stairwell in light cream or green."
      }
    }
  }

  const roomConfig = config[roomType]
  if (roomConfig) {
    const zoneConfig = roomConfig[zone] || roomConfig.default
    return zoneConfig
  }

  return {
    issue: `${roomType} in ${zone} (suboptimal)`,
    recommendation: "Paint the room in light pastel colors matching the zone's element (e.g., green for NE/E, yellow for SW, off-white for NW/W)."
  }
}

/* ── SUB-COMPONENTS ── */

function ReportHeader({ filename, overallScore }) {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return (
    <div className="w-full flex items-center justify-between border-b-2 border-stone-200 pb-3 mb-4">
      <div>
        <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none uppercase">Vastu Analysis Report</h1>
        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mt-1.5">
          Project: <span className="text-stone-700 normal-case">{filename || 'Vastu Project'}</span> • Generated: {generatedDate}
        </p>
      </div>
      <div className="flex items-center gap-4 bg-stone-50 px-4 py-2 border border-stone-200 rounded-xl">
        <div className="text-right">
          <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-stone-400 block leading-none mb-0.5">Overall Compliance</span>
          <span className="text-xl font-black text-orange-600 leading-none">{overallScore}%</span>
        </div>
      </div>
    </div>
  )
}

function ReportFooter({ currentPage, totalPages }) {
  return (
    <div className="w-full flex items-center justify-between border-t border-stone-200 pt-2.5 mt-auto text-[9px] font-bold text-stone-400 uppercase tracking-widest">
      <span>Vastu Analyser Report</span>
      <span>Page {currentPage} of {totalPages}</span>
    </div>
  )
}

function StatusLegend() {
  const statuses = [
    { label: 'Favorable', desc: 'Optimal room placement aligned with Vastu rules.', color: '#16A34A' },
    { label: 'Suboptimal', desc: 'Acceptable placement with minor energy compromises.', color: '#EA580C' },
    { label: 'Unfavorable', desc: 'Conflicting zone placement causing severe energy imbalance.', color: '#DC2626' },
    { label: 'Neutral', desc: 'Neutral placement with negligible vastu impact.', color: '#78716C' },
  ]
  return (
    <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 mb-2.5">Zonal Alignment Legend</h3>
      <div className="grid grid-cols-4 gap-4">
        {statuses.map(s => (
          <div key={s.label} className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <span className="text-xs font-bold text-stone-800 block leading-none mb-1">{s.label}</span>
              <span className="text-[10px] text-stone-400 font-medium leading-tight block">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecommendationsSection({ rows }) {
  // Extract top issues and recommendations
  const issues = rows
    .map(row => {
      const status = getStatus(row)
      const details = getVastuDetails(row.room_type, row.actual_zone, status)
      return { room: row.room_type, status, ...details }
    })
    .filter(item => item.status === 'unfavourable' || item.status === 'inauspicious')

  // Deduplicate and get top 3 issues
  const topIssues = issues.slice(0, 3)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Top Vastu Issues */}
      <div className="border border-red-100 bg-red-50/10 rounded-2xl p-4">
        <h3 className="text-xs font-black text-red-800 uppercase tracking-wider mb-2.5">Top Vastu Concerns</h3>
        {topIssues.length === 0 ? (
          <p className="text-[11px] text-stone-500 font-medium">No severe room placement conflicts detected in the current layout.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topIssues.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-[11px] text-stone-600 leading-relaxed font-medium">
                <span className="text-red-500">⚠️</span>
                <span>
                  <strong className="text-stone-800">{item.room}:</strong> {item.issue}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top Vastu Remedies */}
      <div className="border border-orange-100 bg-orange-50/10 rounded-2xl p-4">
        <h3 className="text-xs font-black text-orange-800 uppercase tracking-wider mb-2.5">Key Recommended Remedies</h3>
        {topIssues.length === 0 ? (
          <p className="text-[11px] text-stone-500 font-medium">The layout is highly aligned. No urgent remedial measures are required.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topIssues.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-[11px] text-stone-600 leading-relaxed font-medium">
                <span className="text-orange-500">🔧</span>
                <span>
                  <strong className="text-stone-800">{item.room}:</strong> {item.recommendation}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ScoringExplanation({ overallScore }) {
  return (
    <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/40 text-stone-600">
      <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider mb-2">How the Score is Calculated</h3>
      <p className="text-[11px] leading-relaxed font-medium mb-2.5">
        Each room type in Vastu Shastra corresponds to specific ideal directions determined by the elements (Water, Fire, Earth, Space, Air). The compliance score is calculated by mapping each room centroid to its corresponding zonal offset angle:
      </p>
      <div className="grid grid-cols-3 gap-3 text-[10px] bg-white border border-stone-100 rounded-xl p-3 font-semibold text-stone-500">
        <div>
          <span className="text-stone-700 block">Favorable Placement:</span> Gives positive impact score points (e.g. Kitchen in SE gives +12.0).
        </div>
        <div>
          <span className="text-stone-700 block">Suboptimal Placement:</span> Yields lower or neutral points, indicating a minor clash.
        </div>
        <div>
          <span className="text-stone-700 block">Unfavorable Placement:</span> deducts significant score points (e.g. Toilet in NE subtracts -10.0).
        </div>
      </div>
      <p className="text-[11px] leading-relaxed font-medium mt-2.5">
        The final score of <strong className="text-orange-600">{overallScore}%</strong> represents the ratio of positive Vastu points scored against the maximum possible score of the identified rooms.
      </p>
    </div>
  )
}

/* ── MAIN COMPONENT ── */

export default function ReportPrintView({
  analysisData,
  floorPlanImg,
  northOffset,
  drawingBounds,
  imageExtent,
  rooms,
  originalRooms = [],
  filename,
}) {
  const rows = analysisData?.rows || []
  const compliance_percent = analysisData?.compliance_percent ?? 0
  const scoredRooms = getScoredRooms(analysisData)

  // Build room data for the map overlay. CompassRose derives its own full
  // room-name labels (numbered per type), so no short codes are computed here.
  const processedRooms = React.useMemo(() => {
    return scoredRooms.map((room) => {
      return {
        ...room,
        roomId: room.room_id,
        x: room.x ?? 0,
        y: room.y ?? 0,
        roomType: room.room_type,
        status: room.status || getStatus(room),
      }
    })
  }, [scoredRooms])

  if (!analysisData) return null

  // 2. Identify User Corrections
  const corrections = rooms.map(room => {
    const orig = originalRooms.find(o => o.room_id === room.room_id)
    const isNew = !orig
    const isModified = orig && orig.type !== room.type
    return {
      name: room.type,
      originalType: isNew ? 'Added Manually' : orig.type,
      finalType: room.type,
      isModified,
      isNew
    }
  }).filter(c => c.isModified || c.isNew)

  // 3. Count room statuses
  const counts = { favorable: 0, suboptimal: 0, unfavorable: 0, neutral: 0 }
  rows.forEach(row => {
    const status = getStatus(row)
    if (status === 'auspicious') counts.favorable++
    else if (status === 'inauspicious') counts.suboptimal++
    else if (status === 'unfavourable') counts.unfavorable++
    else counts.neutral++
  })

  // 4. Paginate tables dynamically (max 6 items per page for landscape layout layout, or 7-8)
  const itemsPerPage = 6
  const pagesCount = Math.ceil(rows.length / itemsPerPage)
  const totalReportPages = 2 + pagesCount // Page 1: Map. Page 2: Summary. Page 3+: Assessment Details Table

  return (
    <div className="print-report-container font-sans text-stone-900 bg-white">
      {/* ──────────────────────────────────────────────────────── */}
      {/* PAGE 1: ENLARGED MAP VIEW                                 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        className="print-page flex flex-col justify-between p-8 animate-none"
        style={{ minHeight: '210mm', width: '297mm', boxSizing: 'border-box' }}
      >
        <ReportHeader filename={filename} overallScore={compliance_percent} />

        <div className="flex-1 flex gap-6 items-stretch min-h-0 py-2">
          {/* Left Column: Enlarged Floor Plan & Compass */}
          <div className="w-[76%] flex flex-col justify-center items-center relative border border-stone-200 rounded-3xl bg-white p-3">
            <h2 className="absolute top-4 left-4 text-xs font-black text-stone-400 uppercase tracking-widest leading-none">
              Vastu Layout Map
            </h2>
            <div className="w-[490px] h-[490px] flex items-center justify-center">
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
              />
            </div>
          </div>

          {/* Right Column: Key Details & Legend */}
          <div className="w-[24%] flex flex-col justify-between gap-4">
            {/* Project Summary Card */}
            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/60 flex-shrink-0">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 mb-2 leading-none">Assessment Summary</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500">Total Rooms:</span>
                  <span className="font-extrabold text-stone-800">{rows.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500">Favorable:</span>
                  <span className="font-extrabold text-green-600">{counts.favorable}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500">Suboptimal:</span>
                  <span className="font-extrabold text-orange-600">{counts.suboptimal}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500">Unfavorable:</span>
                  <span className="font-extrabold text-red-600">{counts.unfavorable}</span>
                </div>
              </div>
            </div>

            {/* Print Legend */}
            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/40 flex-shrink-0">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 mb-3 leading-none">Placement Legend</h3>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#16A34A' }} />
                  <span className="font-semibold text-stone-700">Favorable</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#EA580C' }} />
                  <span className="font-semibold text-stone-700">Suboptimal</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#DC2626' }} />
                  <span className="font-semibold text-stone-700">Unfavorable</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#78716C' }} />
                  <span className="font-semibold text-stone-700">Neutral</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ReportFooter currentPage={1} totalPages={totalReportPages} />
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* PAGE 2: COMPLIANCE SUMMARY & USER CORRECTIONS             */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        className="print-page flex flex-col justify-between p-8 animate-none"
        style={{ minHeight: '210mm', width: '297mm', boxSizing: 'border-box' }}
      >
        <ReportHeader filename={filename} overallScore={compliance_percent} />

        <div className="flex-1 flex flex-col gap-4 py-2 min-h-0 overflow-hidden">
          {/* Zonal Legend */}
          <StatusLegend />

          {/* User Corrections Section */}
          <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/30">
            <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider mb-2.5">Final Room Assignments & User Corrections</h3>
            {corrections.length === 0 ? (
              <p className="text-[11px] text-stone-500 font-medium">The DXF-extracted room categories were accepted directly without modifications.</p>
            ) : (
              <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-200">
                      <th className="px-4 py-2">original detected name/type</th>
                      <th className="px-4 py-2">final user-confirmed name/type</th>
                      <th className="px-4 py-2">Change Type</th>
                      <th className="px-4 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corrections.map((c, idx) => (
                      <tr key={idx} className="border-b border-stone-100">
                        <td className="px-4 py-2 text-stone-500 font-semibold">{c.originalType}</td>
                        <td className="px-4 py-2 text-stone-800 font-bold">{c.finalType}</td>
                        <td className="px-4 py-2 font-bold text-orange-600">
                          {c.isNew ? 'New Addition' : 'Label Corrected'}
                        </td>
                        <td className="px-4 py-2 text-right text-stone-400 font-bold">Applied</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scoring Explanations and Optimization recommendations */}
          <ScoringExplanation overallScore={compliance_percent} />

          {/* Recommendations and Top Issues */}
          <RecommendationsSection rows={rows} />
        </div>

        <ReportFooter currentPage={2} totalPages={totalReportPages} />
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* PAGES 3+: DETAILED ASSESSMENT TABLES                      */}
      {/* ──────────────────────────────────────────────────────── */}
      {Array.from({ length: pagesCount }).map((_, pIdx) => {
        const start = pIdx * itemsPerPage
        const end = Math.min(start + itemsPerPage, rows.length)
        const slicedRows = rows.slice(start, end)
        const pageNumber = 3 + pIdx

        return (
          <div 
            key={pIdx}
            className="print-page flex flex-col justify-between p-8 animate-none"
            style={{ minHeight: '210mm', width: '297mm', boxSizing: 'border-box' }}
          >
            <ReportHeader filename={filename} overallScore={compliance_percent} />

            <div className="flex-1 flex flex-col gap-4 py-2 min-h-0">
              <h2 className="text-xs font-black text-stone-800 uppercase tracking-wider mb-1 leading-none">
                Room-by-Room Assessment ({start + 1} - {end} of {rows.length})
              </h2>

              <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm flex-1 bg-white">
                <table className="w-full text-left text-xs border-collapse h-full">
                  <thead>
                    <tr className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider border-b border-stone-200">
                      <th className="px-3 py-3 w-[15%]">Room Type</th>
                      <th className="px-2 py-3 w-[8%] text-center">Detected Zone</th>
                      <th className="px-2 py-3 w-[15%] text-center">Ideal Zone(s)</th>
                      <th className="px-2 py-3 w-[10%] text-center">Status</th>
                      <th className="px-2 py-3 w-[8%] text-center">Score</th>
                      <th className="px-3 py-3 w-[20%]">Detected Issue</th>
                      <th className="px-3 py-3 w-[24%]">Recommended Remedy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slicedRows.map((row, i) => {
                      const idx = start + i
                      const status = getStatus(row)
                      const barCol = getStatusColor(status)
                      const details = getVastuDetails(row.room_type, row.actual_zone, status)
                      const ideal = IDEAL_ZONES[row.room_type] || 'N/A'

                      return (
                        <tr key={idx} className="border-b border-stone-100 align-top">
                          <td className="px-3 py-2.5 font-black text-stone-800">{row.room_type}</td>
                          <td className="px-2 py-2.5 text-center text-stone-500 font-bold">{row.actual_zone}</td>
                          <td className="px-2 py-2.5 text-center text-stone-500 font-semibold">{ideal}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span 
                              className="inline-flex items-center gap-1 text-[9.5px] font-black px-2.5 py-0.5 rounded-full border leading-none"
                              style={{ 
                                color: barCol, 
                                backgroundColor: getStatusBg(status),
                                borderColor: getStatusBorder(status)
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: barCol }} />
                              {getStatusLabel(status)}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center font-bold text-stone-700">
                            {row.max_score > 0 ? `${row.score} / ${row.max_score}` : '--'}
                          </td>
                          <td className="px-3 py-2.5 text-stone-600 font-medium text-[11px] leading-relaxed">
                            {details.issue}
                          </td>
                          <td className="px-3 py-2.5 text-stone-600 font-medium text-[11px] leading-relaxed">
                            {details.recommendation}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <ReportFooter currentPage={pageNumber} totalPages={totalReportPages} />
          </div>
        )
      })}
    </div>
  )
}
