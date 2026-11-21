// 모둠 편성과 발표 이름 붙이기. 화면도 Firestore 도 모르는 계산만 둔다.
import type { Presentation } from './types'

/** 활동 만들기 화면에서 다루는 모둠 하나 */
export interface GroupDraft {
  /** 화면에서 모둠을 구분하는 열쇠(저장되지 않는다) */
  key: string
  name: string
  studentIds: string[]
}

let keySeq = 0
export function newGroupKey(): string {
  keySeq += 1
  return `g${Date.now().toString(36)}-${keySeq}`
}

export function defaultGroupName(index: number): string {
  return `${index + 1}모둠`
}

/**
 * 학생들을 넘겨받은 순서 그대로 count 개 모둠에 고르게 나눈다.
 * 나누어떨어지지 않으면 앞 모둠부터 한 명씩 더 받는다. (10명을 3모둠 → 4, 3, 3)
 * 학생보다 모둠이 많으면 학생 수만큼만 만든다.
 */
export function splitIntoGroups(studentIds: string[], count: number): GroupDraft[] {
  const n = Math.max(1, Math.min(Math.floor(count), studentIds.length))
  if (studentIds.length === 0) return []
  const base = Math.floor(studentIds.length / n)
  const extra = studentIds.length % n
  const groups: GroupDraft[] = []
  let cursor = 0
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0)
    groups.push({
      key: newGroupKey(),
      name: defaultGroupName(i),
      studentIds: studentIds.slice(cursor, cursor + size),
    })
    cursor += size
  }
  return groups
}

/**
 * 이전 활동의 발표 목록에서 모둠 편성을 되살린다.
 * 그 사이 명단에서 빠진 학생은 덜어 내고, 그래서 비게 된 모둠은 버린다.
 */
export function groupsFromPresentations(
  presentations: Pick<Presentation, 'order' | 'studentIds' | 'groupName'>[],
  currentStudentIds: Set<string>,
): GroupDraft[] {
  return [...presentations]
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({
      key: newGroupKey(),
      name: p.groupName || defaultGroupName(i),
      studentIds: p.studentIds.filter((id) => currentStudentIds.has(id)),
    }))
    .filter((g) => g.studentIds.length > 0)
}

/** 저장해도 되는 편성인지. 문제가 있으면 교사에게 보여 줄 문장을 돌려준다. */
export function groupProblem(groups: GroupDraft[]): string | null {
  if (groups.length === 0) return '모둠을 하나 이상 만들어 주세요.'
  const empty = groups.find((g) => g.studentIds.length === 0)
  if (empty) return `"${empty.name || '이름 없는 모둠'}"에 학생이 없어요. 학생을 넣거나 모둠을 지워 주세요.`
  if (groups.some((g) => !g.name.trim())) return '이름이 비어 있는 모둠이 있어요.'
  const names = groups.map((g) => g.name.trim())
  if (new Set(names).size !== names.length) return '이름이 같은 모둠이 있어요.'
  return null
}

type PresentationLike = Pick<Presentation, 'studentIds' | 'groupName'>

/** 발표를 한마디로 부르는 이름. 모둠이면 모둠 이름, 개인이면 "3번 박나무". */
export function presentationLabel(
  p: PresentationLike,
  nameOf: (studentId: string) => string,
): string {
  if (p.groupName) return p.groupName
  return p.studentIds.length > 0 ? nameOf(p.studentIds[0]) : '(발표자 없음)'
}

/** 모둠 발표일 때 모둠원 이름을 이어 붙인 것. 개인 발표면 빈 문자열. */
export function presentationMembers(
  p: PresentationLike,
  nameOf: (studentId: string) => string,
): string {
  if (!p.groupName) return ''
  return p.studentIds.map(nameOf).join(', ')
}
