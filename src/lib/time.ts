// Firestore 는 시각을 숫자가 아니라 Timestamp 객체로 돌려준다.
// 방금 쓴 문서는 서버 시각이 아직 정해지지 않아 null 로 올 수도 있다.
import type { Timestamp } from 'firebase/firestore'

export type FsTime = Timestamp | number | null | undefined

/** 정렬과 표시에 쓸 밀리초 값. 아직 정해지지 않은 시각은 "지금"으로 본다. */
export function toMillis(value: FsTime): number {
  if (value == null) return Date.now()
  if (typeof value === 'number') return value
  return value.toMillis()
}

/** "11월 21일" 같은 짧은 날짜 */
export function shortDate(value: FsTime): string {
  const d = new Date(toMillis(value))
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** "2026-11-21" 같은 날짜. 엑셀과 파일 이름에 쓴다. */
export function isoDate(value: FsTime): string {
  const d = new Date(toMillis(value))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
