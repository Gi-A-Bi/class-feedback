// 학생 쪽: 익명 인증, 입장 코드로 학급 찾기, 명단에서 이름 고르기.
import { signInAnonymously } from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getAuthClient, getDb } from './firebase'
import type { ClassRoomWithId, JoinCode } from './types'

/** 학생 기기가 쓰는 익명 계정. 없으면 만든다. */
export async function ensureStudentSignedIn(): Promise<string> {
  const auth = getAuthClient()
  // 브라우저에 저장된 로그인 정보를 다 읽어 올 때까지 기다린다.
  // 기다리지 않으면 "아직 아무도 없다"고 잘못 보고 익명 계정을 새로 만들어,
  // 선생님이 로그인해 둔 브라우저에서는 선생님 로그인을 덮어써 버린다.
  await auth.authStateReady()
  if (auth.currentUser) return auth.currentUser.uid
  const cred = await signInAnonymously(auth)
  return cred.user.uid
}

/** 지금 이 기기가 쓰는 계정 uid. 아직 준비 전이면 undefined. */
export function currentUid(): string | undefined {
  return getAuthClient().currentUser?.uid
}

/** 입장 코드로 학급을 찾는다. 코드 문서 하나만 읽는다. */
export async function findClassByJoinCode(code: string): Promise<ClassRoomWithId | null> {
  const codeSnap = await getDoc(doc(getDb(), 'joinCodes', code))
  if (!codeSnap.exists()) return null
  const { classId } = codeSnap.data() as JoinCode
  const classSnap = await getDoc(doc(getDb(), 'classes', classId))
  if (!classSnap.exists()) return null
  return { id: classSnap.id, ...classSnap.data() } as ClassRoomWithId
}

/** 명단에서 이름 하나를 "내가 쓴다"고 표시한다. */
export async function claimStudent(classId: string, studentId: string): Promise<void> {
  const uid = await ensureStudentSignedIn()
  await updateDoc(doc(getDb(), 'classes', classId, 'students', studentId), {
    claimedBy: uid,
    claimedAt: serverTimestamp(),
  })
}

/** 내가 고른 이름을 놓는다(기기를 넘겨줄 때). */
export async function releaseStudent(classId: string, studentId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'classes', classId, 'students', studentId), {
    claimedBy: null,
    claimedAt: null,
  })
}

export function watchClass(
  classId: string,
  onChange: (c: ClassRoomWithId | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), 'classes', classId),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as ClassRoomWithId) : null),
    onError,
  )
}

// ── 이 기기가 누구인지 기억해 둔다 ───────────────────────
// 화면을 새로 고쳐도 다시 코드를 넣지 않게 한다.

const STORAGE_KEY = 'class-feedback:student'

export interface StudentSession {
  classId: string
  className: string
  studentId: string
  studentNumber: number
  studentName: string
}

export function saveSession(session: StudentSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // 태블릿에서 저장이 막혀 있어도 그냥 넘어간다. 다시 고르면 된다.
  }
}

export function loadSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudentSession
    if (!parsed?.classId || !parsed?.studentId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시
  }
}
