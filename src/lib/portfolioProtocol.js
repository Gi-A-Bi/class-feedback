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

// Distinguish an empty teacher account from a message that has not reached its destination.
export function classListStatus(count, acknowledged) {
  if (!count) return '현재 로그인한 계정에 등록된 피드백 학급이 없어요. 아래 계정을 확인하거나 피드백 학급 관리를 열어 주세요.'
  return acknowledged
    ? `학급 ${count}개가 포트폴리오에 전달됐어요. 원래 포트폴리오 창에서 연결할 학급을 선택해 주세요.`
    : `학급 ${count}개를 찾았어요. 포트폴리오 창에 목록이 도착했는지 확인하고 있어요.`
}
