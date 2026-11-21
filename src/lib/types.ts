// Firestore에 저장하는 모양. 기획 문서 "데이터 구조"를 따른다.
import type { FsTime } from './time'

/** 교사가 이름을 붙여 저장해 둔 평가 기준 묶음 */
export interface CriteriaSet {
  id: string
  name: string
  criteria: Criterion[]
}

/** teachers/{uid} */
export interface Teacher {
  name: string
  createdAt: FsTime
  /** 저장한 기준 묶음. 아직 저장한 적이 없으면 없다. */
  criteriaSets?: CriteriaSet[]
}

/** classes/{classId} */
export interface ClassRoom {
  teacherId: string
  name: string
  /** 학생이 입장할 때 넣는 코드. joinCodes/{joinCode} 와 같은 값. */
  joinCode: string
  /**
   * 지금 진행 중인 활동. 학생은 학급 목록을 뒤질 수 없으므로
   * 이 값을 보고 어떤 활동을 평가해야 하는지 찾는다.
   */
  currentActivityId: string | null
  createdAt: FsTime
}

/** classes/{classId}/students/{studentId} */
export interface Student {
  /** 출석 번호 */
  number: number
  name: string
  /** 이 이름을 고른 학생 기기의 익명 계정 uid. 아직 아무도 안 골랐으면 없음. */
  claimedBy?: string
  claimedAt?: FsTime
}

/**
 * joinCodes/{code}
 * 학생은 학급 목록 전체를 뒤질 수 없고, 코드로 이 문서 하나만 읽어 학급을 찾는다.
 */
export interface JoinCode {
  classId: string
  teacherId: string
}

export interface ClassRoomWithId extends ClassRoom {
  id: string
}

export interface StudentWithId extends Student {
  id: string
}

// ── 3단계: 활동, 발표, 평가 ──────────────────────────────

/** 평가 기준 하나. 기본은 내용·전달·자료 세 가지. */
export interface Criterion {
  id: string
  label: string
}

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'content', label: '내용' },
  { id: 'delivery', label: '전달' },
  { id: 'material', label: '자료' },
]

export type ActivityKind = 'individual' | 'group'
export type ActivityStatus = 'ready' | 'running' | 'ended'

/** activities/{activityId} */
export interface Activity {
  classId: string
  teacherId: string
  title: string
  kind: ActivityKind
  criteria: Criterion[]
  /** 지금 평가받는 발표. 아직 시작 전이면 null */
  currentPresentationId: string | null
  status: ActivityStatus
  resultsPublished: boolean
  createdAt: FsTime
}

/** activities/{activityId}/presentations/{presentationId} */
export interface Presentation {
  /** 1부터 시작하는 발표 차례 */
  order: number
  /** 발표하는 학생. 개인 발표면 한 명. */
  studentIds: string[]
  /** 모둠 발표일 때 모둠 이름. 개인이면 빈 문자열. */
  groupName: string
  topic: string
}

export type EvaluationKind = 'peer' | 'self'

/**
 * activities/{activityId}/evaluations/{presentationId}__{studentId}
 * 문서 id를 이렇게 정해 두면 한 발표에 한 학생이 하나만 쓸 수 있다.
 */
export interface Evaluation {
  presentationId: string
  /** 평가한 학생(명단 문서 id) */
  studentId: string
  kind: EvaluationKind
  /** 기준 id -> 1~5 */
  scores: Record<string, number>
  /** 동료 평가면 "칭찬 한 가지", 자기 평가면 "잘한 점" */
  comment1: string
  /** 동료 평가면 "제안 한 가지", 자기 평가면 "다음에 고칠 점" */
  comment2: string
  /** 교사가 부적절한 코멘트를 숨긴 경우 true */
  hidden: boolean
  createdAt: FsTime
  updatedAt: FsTime
}

export interface ActivityWithId extends Activity {
  id: string
}

export interface PresentationWithId extends Presentation {
  id: string
}

export interface EvaluationWithId extends Evaluation {
  id: string
}

/** 코멘트 길이 제한. 보안 규칙에서도 같은 값을 검사한다. */
export const COMMENT_MAX = 200

export function evaluationId(presentationId: string, studentId: string): string {
  return `${presentationId}__${studentId}`
}

// ── 4단계: 공개된 결과 ───────────────────────────────────

/**
 * classes/{classId}/students/{studentId}/records/{activityId}
 *
 * 교사가 "결과 공개"를 누를 때 교사 브라우저가 계산해서 써 넣는다.
 * 학생은 평가(evaluations)를 직접 읽지 못하고 이 문서만 읽으므로,
 * 누가 어떤 평가를 했는지는 학생에게 넘어가지 않는다.
 * 공개를 취소하면 이 문서를 지운다. 문서가 있다는 것이 곧 "공개 중"이다.
 */
export interface StudentRecord {
  activityId: string
  activityTitle: string
  kind: ActivityKind
  groupName: string
  criteria: Criterion[]
  /** 평가해 준 친구 수 */
  peerCount: number
  /** 기준 id -> 친구들이 준 점수의 평균. 평가가 없으면 빈 객체. */
  peerAverages: Record<string, number>
  /** 친구들이 쓴 "칭찬 한 가지". 누가 썼는지 알 수 없게 순서를 섞어 둔다. */
  praise: string[]
  /** 친구들이 쓴 "제안 한 가지". 마찬가지로 섞어 둔다. */
  suggestions: string[]
  /** 내가 한 자기 평가. 안 했으면 null. */
  self: {
    scores: Record<string, number>
    comment1: string
    comment2: string
  } | null
  /** 회차 순서를 정하는 데 쓴다(활동을 만든 시각). */
  activityCreatedAt: FsTime
  publishedAt: FsTime
}

export interface StudentRecordWithId extends StudentRecord {
  id: string
}

// ── 6단계: 누적 기록 ─────────────────────────────────────

/** 한 학생이 한 활동에서 받은 점수 요약. 코멘트는 담지 않는다. */
export interface LedgerEntry {
  /** 모둠 발표였으면 모둠 이름, 개인 발표였으면 빈 문자열 */
  groupName: string
  peerCount: number
  /** 기준 id -> 친구들이 준 점수의 평균 */
  peerAverages: Record<string, number>
  /** 기준 id -> 자기 평가 점수. 자기 평가를 안 했으면 null */
  selfScores: Record<string, number> | null
}

/**
 * classes/{classId}/ledger/{activityId}
 *
 * 교사만 읽는 활동별 점수 요약. 학급의 누적 기록을 볼 때 평가를 하나하나
 * 다시 읽지 않도록(무료 요금제의 읽기 한도를 아끼려고) 활동이 끝날 때 한 번 적어 둔다.
 * 결과를 학생에게 공개했는지와는 상관없다.
 */
export interface Ledger {
  activityId: string
  title: string
  kind: ActivityKind
  criteria: Criterion[]
  activityCreatedAt: FsTime
  updatedAt: FsTime
  /** 학생 id -> 그 학생의 요약. 발표하지 않은 학생은 없다. */
  entries: Record<string, LedgerEntry>
}

export interface LedgerWithId extends Ledger {
  id: string
}
