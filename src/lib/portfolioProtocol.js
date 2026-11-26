// No Firebase objects or credentials leave this protocol boundary.
export const PROTOCOL = 'class-feedback-portfolio-v1'
export function bridgeTarget(hash, development = false) {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const channel = p.get('channel') || ''
  const origin = p.get('origin') || ''
  const google = /^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)?googleusercontent\.com)$/.test(origin)
  const local = development && /^http:\/\/(?:localhost|127\.0\.0\.1):\d{1,5}$/.test(origin)
  if (!/^[a-f0-9]{64}$/.test(channel) || (!google && !local)) return null
  return { channel, origin, label: (p.get('label') || '교사 포트폴리오').slice(0, 80) }
}
export function millis(value) {
  const n = typeof value === 'number' ? value : value?.toMillis?.()
  return Number.isFinite(n) && n > 0 ? n : null
}
export function ledgerSummary(ledger, activity, roster) {
  const at = millis(ledger.activityCreatedAt), updated = millis(ledger.updatedAt)
  if (!at || !updated) return null // Wait for the server timestamp, never invent one.
  const ids = new Set(roster.map(s => s.id))
  const criteria = ledger.criteria.map(c => ({ id: c.id, label: c.label }))
  const pick = scores => Object.fromEntries(criteria.filter(c => typeof scores?.[c.id] === 'number').map(c => [c.id, scores[c.id]]))
  return {
    id: ledger.id, title: ledger.title, kind: ledger.kind,
    occurredAt: new Date(at).toISOString(), updatedAt: new Date(updated).toISOString(),
    sourcePublished: activity?.resultsPublished === true,
    retired: !activity,
    criteria,
    entries: Object.entries(ledger.entries).filter(([studentId]) => ids.has(studentId)).map(([studentId, e]) => ({
      studentId, groupName: e.groupName || '', peerCount: e.peerCount,
      peerAverages: pick(e.peerAverages), selfScores: e.selfScores == null ? null : pick(e.selfScores),
    })),
  }
}
