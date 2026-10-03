import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import AIReportSkeleton from './AIReportSkeleton'
import ChatPanel from './ChatPanel'

const REMEDY_ICONS = {
  color: '🎨',
  object: '🔮',
  plant: '🪴',
  orientation: '🧭',
  habits: '✨',
  lighting: '💡',
  structural: '🏗️',
}

export default function AIReportView({
  reportData,
  analysisData,
  isLoading,
  error,
  onClose,
  onRegenerate,
  filename = '',
  fileId = '',
}) {
  const [filter, setFilter] = useState('all') // 'all' | 'unfavourable' | 'auspicious'
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [expandedRooms, setExpandedRooms] = useState({})

  const toggleExpand = (roomId) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }))
  }

  const roomAnalyses = reportData?.room_analyses || []

  const filteredRooms = useMemo(() => {
    if (filter === 'all') return roomAnalyses
    if (filter === 'unfavourable') {
      return roomAnalyses.filter(
        (r) =>
          r.status === 'unfavourable' ||
          r.status === 'critical' ||
          Number(r.score) <= 0,
      )
    }
    if (filter === 'auspicious') {
      return roomAnalyses.filter(
        (r) => r.status === 'auspicious' || Number(r.score) > 0,
      )
    }
    return roomAnalyses
  }, [roomAnalyses, filter])

  const compliance = reportData?.compliance_percent ?? analysisData?.compliance_percent ?? 0
  const rating = reportData?.overall_rating || (compliance >= 75 ? 'Excellent' : compliance >= 50 ? 'Moderate' : 'Critical')

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-hidden">
      {/* Modal Container */}
      <div className="relative w-full max-w-5xl bg-stone-50 h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 animate-fadeSlideIn">
        
        {/* Top Sticky Header */}
        <div className="px-6 py-4 bg-white/90 backdrop-blur-md border-b border-stone-200/80 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <span className="text-lg font-bold">✨</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-stone-900 font-extrabold text-base md:text-lg playfair">
                  AI-Powered Vastu Evaluation Report
                </h2>
                {reportData?.is_fallback && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                    Knowledge Grounded
                  </span>
                )}
              </div>
              <p className="text-stone-500 text-xs">
                {filename ? `Plan: ${filename} • ` : ''}
                {reportData?.generated_at ? `Generated ${new Date(reportData.generated_at).toLocaleTimeString()}` : 'Live Grounded Analysis'}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChatOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <span>💬</span>
              <span>Ask AI Consultant</span>
            </button>

            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isLoading}
                title="Regenerate report"
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? 'animate-spin' : ''}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l6 6" />
                </svg>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              title="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          {isLoading && <AIReportSkeleton />}

          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center space-y-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="font-bold text-red-900 text-base">Report Generation Error</h3>
              <p className="text-red-700 text-xs max-w-md mx-auto">{error}</p>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {!isLoading && !error && reportData && (
            <>
              {/* Executive Summary Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-stone-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600">
                      Executive Summary
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-stone-900 playfair mt-0.5">
                      Vastu Energy & Harmony Index
                    </h3>
                  </div>

                  {/* Rating Badge */}
                  <div className="flex items-center gap-3 bg-stone-50 border border-stone-200/80 rounded-2xl px-4 py-2">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Rating</p>
                      <p className="text-sm font-extrabold text-stone-800">{rating}</p>
                    </div>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm"
                      style={{
                        backgroundColor:
                          compliance >= 70 ? '#16A34A' : compliance >= 45 ? '#EA580C' : '#DC2626',
                      }}
                    >
                      {compliance}%
                    </div>
                  </div>
                </div>

                <div className="text-stone-700 text-sm leading-relaxed space-y-2.5">
                  <p>{reportData.executive_summary}</p>
                  {reportData.overall_energy_assessment && (
                    <p className="text-stone-600 text-xs italic bg-orange-50/50 border border-orange-100/70 rounded-2xl p-3.5">
                      🌱 <strong className="text-stone-800 not-italic">Cosmic Prana Assessment: </strong>
                      {reportData.overall_energy_assessment}
                    </p>
                  )}
                </div>
              </div>

              {/* Grid: Highlights & Priority Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Positive Highlights */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-emerald-100 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <span className="text-lg">🌿</span>
                    <h4 className="font-extrabold text-sm uppercase tracking-wide">
                      Auspicious Alignments
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {reportData.positive_highlights?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-900 font-medium"
                      >
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Action Items */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-amber-100 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <span className="text-lg">🎯</span>
                    <h4 className="font-extrabold text-sm uppercase tracking-wide">
                      Priority Remediation Plan
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {reportData.priority_actions?.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 bg-amber-50/60 border border-amber-100 rounded-2xl p-3 text-xs text-stone-800"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black flex items-center justify-center shrink-0 text-[11px]">
                          {action.priority || idx + 1}
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-stone-900 flex items-center gap-2">
                            {action.room_type} ({action.direction})
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-red-100 text-red-800 rounded-md">
                              {action.impact} Impact
                            </span>
                          </p>
                          <p className="text-stone-600 leading-snug">{action.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optimization Section (if present) */}
              {reportData.optimization_narrative && (
                <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent rounded-3xl p-6 border border-orange-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                    <span>🔄</span>
                    <h4>Layout Swap & Geometric Enhancement</h4>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {reportData.optimization_narrative}
                  </p>
                </div>
              )}

              {/* Room-by-Room Breakdown */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 playfair">
                      Room-by-Room Energetic Profile
                    </h3>
                    <p className="text-xs text-stone-500">
                      Personalized analysis and non-invasive remedies for each space
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        filter === 'all'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      All ({roomAnalyses.length})
                    </button>
                    <button
                      onClick={() => setFilter('unfavourable')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        filter === 'unfavourable'
                          ? 'bg-red-50 text-red-700 shadow-xs'
                          : 'text-stone-500 hover:text-red-700'
                      }`}
                    >
                      Needs Remedy
                    </button>
                    <button
                      onClick={() => setFilter('auspicious')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        filter === 'auspicious'
                          ? 'bg-green-50 text-green-700 shadow-xs'
                          : 'text-stone-500 hover:text-green-700'
                      }`}
                    >
                      Auspicious
                    </button>
                  </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRooms.map((room, idx) => {
                    const isAuspicious = room.status === 'auspicious' || Number(room.score) > 0
                    const isExpanded = expandedRooms[room.room_id || idx]

                    return (
                      <div
                        key={room.room_id || idx}
                        className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-stone-900 text-sm">
                                {room.room_type}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                {room.direction}
                              </span>
                            </div>

                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isAuspicious
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {Number(room.score).toFixed(1)} / {Number(room.max_score).toFixed(1)}
                            </span>
                          </div>

                          <p className="text-xs text-stone-700 leading-relaxed">
                            {room.narrative}
                          </p>

                          {room.traditional_significance && (
                            <div className="pt-2 border-t border-stone-100">
                              <button
                                onClick={() => toggleExpand(room.room_id || idx)}
                                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide' : 'View'} Classical Vastu Context</span>
                                <span>{isExpanded ? '▲' : '▼'}</span>
                              </button>
                              {isExpanded && (
                                <p className="text-[11px] text-stone-500 mt-1.5 bg-stone-50 p-2.5 rounded-xl leading-relaxed">
                                  {room.traditional_significance}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Remedies if present */}
                        {room.remedies && room.remedies.length > 0 && (
                          <div className="pt-3 border-t border-stone-100 space-y-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                              Remedial Interventions
                            </p>
                            <div className="space-y-1.5">
                              {room.remedies.map((remedy, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="bg-amber-50/40 border border-amber-200/50 rounded-xl p-2 text-[11px] text-stone-700 space-y-0.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-stone-900 flex items-center gap-1">
                                      <span>{REMEDY_ICONS[remedy.type] || '✨'}</span>
                                      {remedy.title || remedy.type}
                                    </span>
                                    {remedy.severity && (
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-600">
                                        {remedy.severity}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-stone-600 text-[11px] leading-tight">
                                    {remedy.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar with CTA */}
        <div className="px-6 py-3.5 bg-white border-t border-stone-200 flex items-center justify-between">
          <p className="text-xs text-stone-500 hidden sm:block">
            Have questions about these remedies? Ask our grounded AI consultant.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setIsChatOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <span>💬</span>
              <span>Open AI Chat</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Chat Drawer */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          fileId={fileId}
          analysisData={analysisData}
          reportData={reportData}
        />
      </div>
    </div>,
    document.body,
  )
}
