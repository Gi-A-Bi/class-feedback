// 여러 활동에 걸친 기록을 한 학생의 "모아 보기"로 합치는 계산. 화면도 Firestore 도 모른다.
// 학생의 "내 기록"과 교사의 누적 기록이 같이 쓴다.
import { overallAverage } from './results'
import type { Criterion, GivenStats } from './types'

/** 한 활동에서 한 학생에게 일어난 일. 공개 결과에서도 교사용 요약에서도 만들 수 있다. */
export interface DashboardItem {
  criteria: Criterion[]
  /** 발표를 했는지. 안 했으면 받은 점수는 모두 비어 있다. */
  presented: boolean
  peerCount: number
  peerAverages: Record<string, number>
  selfScores: Record<string, number> | null
  teacherScores: Record<string, number> | null
  given: GivenStats | null
}

export interface CriterionRow {
  id: string
  label: string
  /** 그 기준으로 받은(또는 준) 점수의 평균. 한 번도 없었으면 null. */
  peer: number | null
  self: number | null
  teacher: number | null
  given: number | null
}

export interface Dashboard {
  /** 발표한 횟수 */
  presentedCount: number
  /** 친구들에게 받은 평가 수(발표마다 평가해 준 친구 수를 더한 것) */
  receivedCount: number
  /** 발표마다의 전체 평균을 다시 평균한 것 */
  peerAverage: number | null
  selfAverage: number | null
  teacherAverage: number | null
  /** 친구들에게 준 평가 수 */
  givenCount: number
  /** 내가 준 별 전체의 평균 */
  givenAverage: number | null
  /** 별 1개~5개를 각각 몇 번 줬는지 */
  givenDistribution: number[]
  /** 기준별로 모은 것. 활동마다 기준이 달라도 id 가 같으면 같은 기준으로 본다. */
  criteria: CriterionRow[]
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

function meanOfScores(scores: Record<string, number> | null | undefined): number | null {
  return scores ? overallAverage(scores) : null
}

const notNull = (v: number | null): v is number => v !== null

export function buildDashboard(items: DashboardItem[]): Dashboard {
  const presented = items.filter((i) => i.presented)
  const givenDistribution = [0, 0, 0, 0, 0]
  let givenCount = 0
  for (const i of items) {
    if (!i.given) continue
    givenCount += i.given.count
    i.given.distribution.forEach((n, k) => {
      if (k < 5) givenDistribution[k] += n
    })
  }
  const stars = givenDistribution.reduce((a, b) => a + b, 0)
  const givenAverage = stars
    ? givenDistribution.reduce((sum, n, k) => sum + n * (k + 1), 0) / stars
    : null

  // 기준은 처음 나온 순서대로 늘어놓고, 이름은 가장 최근 활동의 것을 쓴다.
  const order: string[] = []
  const labels = new Map<string, string>()
  const bucket = new Map<string, { peer: number[]; self: number[]; teacher: number[]; given: number[] }>()
  for (const i of items) {
    for (const c of i.criteria) {
      if (!bucket.has(c.id)) {
        order.push(c.id)
        bucket.set(c.id, { peer: [], self: [], teacher: [], given: [] })
      }
      labels.set(c.id, c.label)
      const b = bucket.get(c.id)!
      const push = (list: number[], v: number | undefined) => {
        if (typeof v === 'number') list.push(v)
      }
      if (i.presented) {
        push(b.peer, i.peerAverages[c.id])
        push(b.self, i.selfScores?.[c.id])
        push(b.teacher, i.teacherScores?.[c.id])
      }
      push(b.given, i.given?.averages[c.id])
    }
  }

  return {
    presentedCount: presented.length,
    receivedCount: presented.reduce((sum, i) => sum + i.peerCount, 0),
    peerAverage: mean(presented.map((i) => overallAverage(i.peerAverages)).filter(notNull)),
    selfAverage: mean(presented.map((i) => meanOfScores(i.selfScores)).filter(notNull)),
    teacherAverage: mean(presented.map((i) => meanOfScores(i.teacherScores)).filter(notNull)),
    givenCount,
    givenAverage,
    givenDistribution,
    criteria: order
      .map((id) => {
        const b = bucket.get(id)!
        return {
          id,
          label: labels.get(id) ?? id,
          peer: mean(b.peer),
          self: mean(b.self),
          teacher: mean(b.teacher),
          given: mean(b.given),
        }
      })
      // 받은 것도 준 것도 없는 기준은 보여 줄 것이 없다
      .filter((r) => r.peer !== null || r.self !== null || r.teacher !== null || r.given !== null),
  }
}
