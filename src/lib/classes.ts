// 학급과 명단을 읽고 쓰는 곳. 화면은 여기만 호출한다.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getDb } from './firebase'
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
      rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
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

/** 학급과 그 아래 명단, 입장 코드 문서를 지운다. */
export async function deleteClass(classId: string, joinCode: string): Promise<void> {
  const db = getDb()
  const students = await getDocs(collection(db, 'classes', classId, 'students'))
  const batch = writeBatch(db)
  for (const s of students.docs) batch.delete(s.ref)
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

/** 명단을 통째로 바꾼다. 기존 명단은 지우고 새로 넣는다. */
export async function replaceRoster(
  classId: string,
  students: ParsedStudent[],
): Promise<void> {
  const db = getDb()
  const existing = await getDocs(collection(db, 'classes', classId, 'students'))
  const batch = writeBatch(db)
  for (const s of existing.docs) batch.delete(s.ref)
  for (const s of students) {
    batch.set(doc(collection(db, 'classes', classId, 'students')), {
      number: s.number,
      name: s.name,
    })
  }
  await batch.commit()
}

export async function deleteStudent(classId: string, studentId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'classes', classId, 'students', studentId))
}
