// Firestore에 저장하는 모양. 기획 문서 "데이터 구조"를 따른다.

/** teachers/{uid} */
export interface Teacher {
  name: string
  createdAt: number
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
  createdAt: number
}

/** classes/{classId}/students/{studentId} */
export interface Student {
  /** 출석 번호 */
  number: number
  name: string
  /** 이 이름을 고른 학생 기기의 익명 계정 uid. 아직 아무도 안 골랐으면 없음. */
  claimedBy?: string
  claimedAt?: number
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
  createdAt: number
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
  createdAt: number
  updatedAt: number
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
