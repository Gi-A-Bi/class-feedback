// 학급과 명단을 읽고 쓰는 곳. 화면은 여기만 호출한다.
import {
  collection,
  deleteDoc,
  doc,
  type DocumentReference,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { toMillis } from './time'
import { generateJoinCode } from './joinCode'
import type { ClassRoomWithId, StudentWithId } from './types'

/** 교사가 가진 학급을 실시간으로 지켜본다. 정리 함수를 돌려준다. */
export function watchMyClasses(
  teacherId: string,
  onChange: (classes: ClassRoomWithId[]) => void,
  onError: (error: unknown) => void,
): () => void {
  // where + orderBy를 같이 쓰면 색인을 따로 만들어야 해서, 정렬은 브라우저에서 한다.
  const q = query(collection(getDb(), 'classes'), where('teacherId', '==', teacherId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoomWithId)
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      onChange(rows)
    },
    onError,
  )
}

/** 학급 하나의 명단을 번호순으로 지켜본다. */
export function watchStudents(
  classId: string,
  onChange: (students: StudentWithId[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const q = query(
    collection(getDb(), 'classes', classId, 'students'),
    orderBy('number'),
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentWithId))
    },
    onError,
  )
}

export async function getClass(classId: string): Promise<ClassRoomWithId | null> {
  const snap = await getDoc(doc(getDb(), 'classes', classId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as ClassRoomWithId
}

/**
 * 학급을 만든다.
 * 입장 코드는 joinCodes/{code} 문서로도 따로 저장한다.
 * 학생이 학급 목록을 뒤지지 않고 코드로 문서 하나만 읽어 학급을 찾게 하기 위해서다.
 * 코드가 이미 쓰이고 있으면 다시 뽑는다.
 */
export async function createClass(
  teacherId: string,
  name: string,
): Promise<ClassRoomWithId> {
  const db = getDb()
  const classRef = doc(collection(db, 'classes'))

  let joinCode = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateJoinCode()
    const taken = await getDoc(doc(db, 'joinCodes', candidate))
    if (!taken.exists()) {
      joinCode = candidate
      break
    }
  }
  if (!joinCode) {
    throw new Error('입장 코드를 만들지 못했습니다. 잠시 뒤 다시 해 주세요.')
  }

  const batch = writeBatch(db)
  batch.set(classRef, {
    teacherId,
    name,
    joinCode,
    currentActivityId: null,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'joinCodes', joinCode), {
    classId: classRef.id,
    teacherId,
  })
  await batch.commit()

  return {
    id: classRef.id,
    teacherId,
    name,
    joinCode,
    currentActivityId: null,
    createdAt: Date.now(),
  }
}

export async function renameClass(classId: string, name: string): Promise<void> {
  await setDoc(doc(getDb(), 'classes', classId), { name }, { merge: true })
}

/** 한 묶음(batch)에 담을 수 있는 쓰기는 500건까지라 넉넉히 끊어 지운다. */
async function deleteInChunks(refs: DocumentReference[]): Promise<void> {
  const db = getDb()
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref)
    await batch.commit()
  }
}

/** 학생에게 공개해 둔 결과 문서들. 학생 문서를 지워도 저절로 지워지지 않으므로 따로 찾는다. */
async function recordRefsOf(classId: string, studentId: string): Promise<DocumentReference[]> {
  const snap = await getDocs(
    collection(getDb(), 'classes', classId, 'students', studentId, 'records'),
  )
  return snap.docs.map((d) => d.ref)
}

/**
 * 학급을 지운다. 그 학급의 활동(발표 순서, 평가), 공개한 결과, 누적 기록,
 * 명단, 입장 코드까지 모두 지운다. 개인정보처리방침의 "학급을 지우면 바로
 * 파기"가 이 함수에 달려 있으니, 학급 아래에 새 데이터가 생기면 여기에도 더한다.
 *
 * 순서가 중요하다. 보안 규칙이 부모 문서(활동, 학급)를 읽어 주인을 확인하므로
 * 아래 문서를 먼저 지우고 부모를 나중에 지운다.
 */
export async function deleteClass(
  classId: string,
  joinCode: string,
  teacherId: string,
): Promise<void> {
  const db = getDb()

  // 1. 이 학급의 활동과 그 아래 발표 순서·평가
  const mine = await getDocs(
    query(collection(db, 'activities'), where('teacherId', '==', teacherId)),
  )
  const activities = mine.docs.filter((d) => d.data().classId === classId)
  for (const activity of activities) {
    const [presentations, evaluations] = await Promise.all([
      getDocs(collection(activity.ref, 'presentations')),
      getDocs(collection(activity.ref, 'evaluations')),
    ])
    await deleteInChunks([...presentations.docs, ...evaluations.docs].map((d) => d.ref))
    await deleteDoc(activity.ref)
  }

  // 2. 학생에게 공개한 결과, 누적 기록, 명단
  const [students, ledgers] = await Promise.all([
    getDocs(collection(db, 'classes', classId, 'students')),
    getDocs(collection(db, 'classes', classId, 'ledger')),
  ])
  const records = await Promise.all(students.docs.map((s) => recordRefsOf(classId, s.id)))
  await deleteInChunks([...records.flat(), ...ledgers.docs.map((d) => d.ref)])
  await deleteInChunks(students.docs.map((d) => d.ref))

  // 3. 입장 코드와 학급
  const batch = writeBatch(db)
  batch.delete(doc(db, 'joinCodes', joinCode))
  batch.delete(doc(db, 'classes', classId))
  await batch.commit()
}

export interface ParsedStudent {
  number: number
  name: string
}

/**
 * 붙여넣은 명단을 번호와 이름으로 나눈다.
 * 엑셀에서 복사하면 탭으로, 손으로 치면 빈칸이나 점으로 나뉘는 걸 모두 받는다.
 *   "1	김하늘"  "1 김하늘"  "1. 김하늘"  "1,김하늘"
 * 번호가 없는 줄은 위에서부터 차례로 번호를 매긴다.
 */
export function parseRoster(text: string): {
  students: ParsedStudent[]
  problems: string[]
} {
  const students: ParsedStudent[] = []
  const problems: string[] = []
  const seenNumbers = new Set<number>()
  let autoNumber = 0

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const match = /^(\d{1,3})\s*[.,\t)]?\s*(.+)$/.exec(line)
    let number: number
    let name: string

    if (match) {
      number = Number(match[1])
      name = match[2].trim()
    } else {
      autoNumber += 1
      number = autoNumber
      name = line
    }

    if (!name) {
      problems.push(`"${line}" — 이름이 없어요.`)
      continue
    }
    if (name.length > 20) {
      problems.push(`"${line}" — 이름이 너무 길어요.`)
      continue
    }
    if (seenNumbers.has(number)) {
      problems.push(`${number}번이 두 번 나와요. ("${name}")`)
      continue
    }

    seenNumbers.add(number)
    autoNumber = Math.max(autoNumber, number)
    students.push({ number, name })
  }

  return { students, problems }
}

/** 붙여넣은 명단을 적용하면 무엇이 달라지는지. 저장하기 전에 보여 준다. */
export interface RosterChange {
  added: ParsedStudent[]
  renamed: { number: number; from: string; to: string }[]
  removed: { number: number; name: string }[]
  unchanged: number
}

export function planRosterChange(
  existing: { number: number; name: string }[],
  incoming: ParsedStudent[],
): RosterChange {
  const byNumber = new Map(existing.map((s) => [s.number, s]))
  const incomingNumbers = new Set(incoming.map((s) => s.number))
  const change: RosterChange = { added: [], renamed: [], removed: [], unchanged: 0 }
  for (const s of incoming) {
    const before = byNumber.get(s.number)
    if (!before) change.added.push(s)
    else if (before.name !== s.name) change.renamed.push({ number: s.number, from: before.name, to: s.name })
    else change.unchanged += 1
  }
  for (const s of existing) {
    if (!incomingNumbers.has(s.number)) change.removed.push({ number: s.number, name: s.name })
  }
  return change
}

/**
 * 붙여넣은 명단을 적용한다.
 * 번호가 같은 학생은 문서를 그대로 두고 이름만 고친다. 학생 문서 id 가 바뀌면
 * 지난 활동의 발표 순서와 쌓인 기록이 그 학생을 가리키지 못하게 되기 때문이다.
 * 새 명단에 없는 번호는 지우고, 새로 생긴 번호는 더한다.
 */
export async function replaceRoster(
  classId: string,
  students: ParsedStudent[],
): Promise<void> {
  const db = getDb()
  const existing = await getDocs(collection(db, 'classes', classId, 'students'))
  const byNumber = new Map(existing.docs.map((d) => [d.data().number as number, d]))
  const incomingNumbers = new Set(students.map((s) => s.number))

  const batch = writeBatch(db)
  for (const s of students) {
    const before = byNumber.get(s.number)
    if (!before) {
      batch.set(doc(collection(db, 'classes', classId, 'students')), {
        number: s.number,
        name: s.name,
      })
    } else if (before.data().name !== s.name) {
      batch.update(before.ref, { name: s.name })
    }
  }
  const removed = existing.docs.filter((d) => !incomingNumbers.has(d.data().number as number))
  for (const d of removed) batch.delete(d.ref)
  // 명단에서 빠진 학생에게 공개해 둔 결과도 함께 지운다.
  const records = await Promise.all(removed.map((d) => recordRefsOf(classId, d.id)))
  await deleteInChunks(records.flat())
  await batch.commit()
}

/** 학생을 명단에서 지운다. 그 학생에게 공개해 둔 결과도 함께 지운다. */
export async function deleteStudent(classId: string, studentId: string): Promise<void> {
  await deleteInChunks(await recordRefsOf(classId, studentId))
  await deleteDoc(doc(getDb(), 'classes', classId, 'students', studentId))
}

/** 교사가 "다른 기기에서 고른 이름"을 풀어 준다. 그 기기는 입장 화면으로 돌아간다. */
export async function releaseClaim(classId: string, studentId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'classes', classId, 'students', studentId), {
    claimedBy: null,
    claimedAt: null,
  })
}

/** 학급 전체의 이름 고름을 한꺼번에 푼다(수업을 새로 시작할 때). */
export async function releaseAllClaims(classId: string, studentIds: string[]): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  for (const id of studentIds) {
    batch.update(doc(db, 'classes', classId, 'students', id), {
      claimedBy: null,
      claimedAt: null,
    })
  }
  await batch.commit()
}
