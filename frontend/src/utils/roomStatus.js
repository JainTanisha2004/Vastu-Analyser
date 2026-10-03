// Single source of truth for room Vaastu status classification + colors.
// Previously this logic was duplicated (and subtly divergent) across
// ReportStep, CompassRose, VastuMapAnalysisView, VastuReportPreview and
// ReportPrintView. Keep all status decisions here.

/**
 * Classify a scored row into one of: 'auspicious' | 'inauspicious' |
 * 'unfavourable' | 'neutral'. Accepts either {score, max_score} or
 * {score, maxScore}. Missing/invalid scores are treated as neutral.
 */
export function getRoomStatus(row) {
  if (!row) return 'neutral'
  const score = Number(row.score)
  const maxScore = Number(row.max_score ?? row.maxScore)

  if (Number.isNaN(score) || Number.isNaN(maxScore)) return 'neutral'
  if (maxScore === 0 && score === 0) return 'neutral'
  if (score < 0) return 'unfavourable'
  if (maxScore > 0 && score / maxScore >= 0.5) return 'auspicious'
  return 'inauspicious'
}

// Canonical color per status.
export const STATUS_COLORS = {
  auspicious: '#16A34A',
  inauspicious: '#EA580C',
  unfavourable: '#DC2626',
  neutral: '#78716C',
}

export function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.neutral
}

// Human-facing labels (British spelling, matching existing UI).
export const STATUS_LABELS = {
  auspicious: 'Auspicious',
  inauspicious: 'Inauspicious',
  unfavourable: 'Unfavourable',
  neutral: 'Neutral',
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || 'Neutral'
}
