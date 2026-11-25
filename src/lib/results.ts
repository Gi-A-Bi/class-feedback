// 평가들을 모아 학생에게 보여 줄 결과로 바꾸는 계산. 화면도 Firestore 도 모른다.
import {
  TEACHER_EVALUATOR_ID,
  type Activity,
  type Evaluation,
  type GivenStats,
  type LedgerEntry,
  type Presentation,
  type ScoredComment,
  type StudentRecord,
} from './types'

type PresentationLike = Presentation & { id: string }

/** 계산 결과. activityCreatedAt 과 publishedAt 은 저장할 때 붙인다. */
export type RecordBody = Omit<StudentRecord, 'activityId' | 'activityCreatedAt' | 'publishedAt'>

/** 한 발표에 대한 요약. 교사 검토 화면과 공개용 결과가 같이 쓴다. */
export interface PresentationSummary {
  peerCount: number
  peerAverages: Record<string, number>
}

/**
 * 그 평가가 자기 평가인지는 "평가한 학생이 그 발표의 발표자인가"로 정한다.
 * 평가 문서의 kind 값은 학생 기기가 적어 보낸 것이라 그대로 믿지 않는다.
 * (발표자가 자기 발표에 동료 평가인 척 점수를 넣어도 평균에 섞이지 않는다.)
 */
export function isSelfEvaluation(e: Evaluation, p: Presentation): boolean {
  return p.studentIds.includes(e.studentId)
}

/** 선생님이 쓴 평가인지. 친구들 평균에도 자기 평가에도 넣지 않고 따로 보여 준다. */
export function isTeacherEvaluation(e: Pick<Evaluation, 'studentId'>): boolean {
  return e.studentId === TEACHER_EVALUATOR_ID
}

/** 친구가 쓴 평가인지(자기 평가도 선생님 평가도 아닌 것). */
export function isPeerEvaluation(e: Evaluation, p: Presentation): boolean {
  return !isTeacherEvaluation(e) && !isSelfEvaluation(e, p)
}

export function summarize(
  criteria: Activity['criteria'],
  presentation: Presentation,
  evaluations: Evaluation[],
): PresentationSummary {
  const peers = evaluations.filter((e) => isPeerEvaluation(e, presentation))
  const peerAverages: Record<string, number> = {}
  for (const c of criteria) {
    const values = peers
      .map((e) => e.scores[c.id])
      .filter((v): v is number => typeof v === 'number')
    if (values.length > 0) {
      peerAverages[c.id] = values.reduce((a, b) => a + b, 0) / values.length
    }
  }
  return { peerCount: peers.length, peerAverages }
}

/** 순서로 누가 썼는지 짐작하지 못하게 섞는다. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 활동 하나의 평가 전체를 학생별 공개 결과로 바꾼다.
 * 돌려주는 Map 의 열쇠는 학생 id.
 * - 교사가 숨긴 평가는 점수는 평균에 넣되 코멘트는 뺀다.
 * - 코멘트는 순서를 섞는다. 칭찬과 제안을 따로 섞어 짝도 맞출 수 없게 한다.
 */
export function buildRecords(
  activity: Pick<Activity, 'title' | 'kind' | 'criteria'>,
  presentations: PresentationLike[],
  evaluations: Evaluation[],
  random: () => number = Math.random,
): Map<string, RecordBody> {
  const records = new Map<string, RecordBody>()
  const given = buildGiven(activity, presentations, evaluations)

  for (const p of presentations) {
    const mine = evaluations.filter((e) => e.presentationId === p.id)
    const peers = mine.filter((e) => isPeerEvaluation(e, p))
    const teacherEval = mine.find(isTeacherEvaluation)
    const teacher: ScoredComment | null = teacherEval
      ? {
          scores: teacherEval.scores,
          comment1: teacherEval.comment1.trim(),
          comment2: teacherEval.comment2.trim(),
        }
      : null
    const { peerCount, peerAverages } = summarize(activity.criteria, p, mine)

    const visible = peers.filter((e) => !e.hidden)
    const praise = shuffle(
      visible.map((e) => e.comment1.trim()).filter(Boolean),
      random,
    )
    const suggestions = shuffle(
      visible.map((e) => e.comment2.trim()).filter(Boolean),
      random,
    )

    for (const studentId of p.studentIds) {
      const self = mine.find((e) => e.studentId === studentId)
      records.set(studentId, {
        activityTitle: activity.title,
        kind: activity.kind,
        groupName: p.groupName,
        criteria: activity.criteria,
        peerCount,
        peerAverages,
        praise,
        suggestions,
        self: self
          ? {
              scores: self.scores,
              comment1: self.hidden ? '' : self.comment1.trim(),
              comment2: self.hidden ? '' : self.comment2.trim(),
            }
          : null,
        teacher,
        given: given[studentId] ?? null,
        presented: true,
      })
    }
  }

  // 발표는 안 하고 평가만 한 학생에게도 "내가 준 별"은 보여 준다.
  for (const [studentId, stats] of Object.entries(given)) {
    if (records.has(studentId)) continue
    records.set(studentId, {
      activityTitle: activity.title,
      kind: activity.kind,
      groupName: '',
      criteria: activity.criteria,
      peerCount: 0,
      peerAverages: {},
      praise: [],
      suggestions: [],
      self: null,
      teacher: null,
      given: stats,
      presented: false,
    })
  }

  return records
}

/**
 * 학생마다 "이 활동에서 친구들에게 준 평가"를 요약한다. 열쇠는 학생 id.
 * 자기 평가와 선생님 평가, 지워진 발표에 남은 평가는 세지 않는다.
 */
export function buildGiven(
  activity: Pick<Activity, 'criteria'>,
  presentations: PresentationLike[],
  evaluations: Evaluation[],
): Record<string, GivenStats> {
  const byId = new Map(presentations.map((p) => [p.id, p]))
  const mineOf = new Map<string, Evaluation[]>()
  for (const e of evaluations) {
    const p = byId.get(e.presentationId)
    if (!p || !isPeerEvaluation(e, p)) continue
    mineOf.set(e.studentId, [...(mineOf.get(e.studentId) ?? []), e])
  }

  const given: Record<string, GivenStats> = {}
  for (const [studentId, list] of mineOf) {
    const averages: Record<string, number> = {}
    const distribution = [0, 0, 0, 0, 0]
    for (const c of activity.criteria) {
      const values = list
        .map((e) => e.scores[c.id])
        .filter((v): v is number => typeof v === 'number')
      if (values.length > 0) averages[c.id] = values.reduce((a, b) => a + b, 0) / values.length
      for (const v of values) {
        if (Number.isInteger(v) && v >= 1 && v <= 5) distribution[v - 1] += 1
      }
    }
    given[studentId] = { count: list.length, averages, distribution }
  }
  return given
}

/**
 * 활동 하나의 평가 전체를 학생별 점수 요약으로 바꾼다(교사의 누적 기록용).
 * 코멘트는 담지 않으므로 숨김 여부와 상관없다.
 */
export function buildLedgerEntries(
  activity: Pick<Activity, 'criteria'>,
  presentations: PresentationLike[],
  evaluations: Evaluation[],
): Record<string, LedgerEntry> {
  const entries: Record<string, LedgerEntry> = {}
  for (const p of presentations) {
    const mine = evaluations.filter((e) => e.presentationId === p.id)
    const { peerCount, peerAverages } = summarize(activity.criteria, p, mine)
    const teacher = mine.find(isTeacherEvaluation)
    for (const studentId of p.studentIds) {
      const self = mine.find((e) => e.studentId === studentId)
      entries[studentId] = {
        groupName: p.groupName,
        peerCount,
        peerAverages,
        selfScores: self ? self.scores : null,
        teacherScores: teacher ? teacher.scores : null,
        presentationId: p.id,
      }
    }
  }
  return entries
}

/** 기준별 평균들의 평균. 회차별 변화를 한 숫자로 보여 줄 때 쓴다. 평가가 없으면 null. */
export function overallAverage(averages: Record<string, number>): number | null {
  const values = Object.values(averages)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
