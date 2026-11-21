/**
 * 보안 규칙 테스트. Firestore 에뮬레이터에 대고 돌린다.
 *   npm run test:rules
 * 기획 문서의 "보안 규칙 요구사항"을 한 줄씩 확인한다.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let testEnv: RulesTestEnvironment

const TEACHER_A = 'teacher-a'
const TEACHER_B = 'teacher-b'
const STUDENT = 'student-1'
const CLASS_A = 'class-a'
const CODE_A = 'ABC234'

/** 구글 로그인한 교사처럼 보이는 사용자 */
function teacher(uid: string) {
  return testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore()
}

/** 익명 인증을 쓰는 학생 */
function student(uid = STUDENT) {
  return testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
}

function anonymousVisitor() {
  return testEnv.unauthenticatedContext().firestore()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-class-feedback',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  // 규칙을 건너뛰고 밑자료를 깔아 둔다.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'classes', CLASS_A), {
      teacherId: TEACHER_A,
      name: '3학년 2반',
      joinCode: CODE_A,
      createdAt: new Date(),
    })
    await setDoc(doc(db, 'joinCodes', CODE_A), {
      classId: CLASS_A,
      teacherId: TEACHER_A,
    })
    await setDoc(doc(db, 'classes', CLASS_A, 'students', 's1'), {
      number: 1,
      name: '김하늘',
    })
  })
})

describe('교사 문서', () => {
  it('자기 문서는 만들고 읽을 수 있다', async () => {
    const db = teacher(TEACHER_A)
    await assertSucceeds(
      setDoc(doc(db, 'teachers', TEACHER_A), { name: '박선생', createdAt: serverTimestamp() }),
    )
    await assertSucceeds(getDoc(doc(db, 'teachers', TEACHER_A)))
  })

  it('남의 교사 문서는 못 읽고 못 쓴다', async () => {
    const db = teacher(TEACHER_B)
    await assertFails(
      setDoc(doc(db, 'teachers', TEACHER_A), { name: '가로채기', createdAt: serverTimestamp() }),
    )
    await assertFails(getDoc(doc(db, 'teachers', TEACHER_A)))
  })

  it('학생(익명)은 교사 문서를 만들 수 없다', async () => {
    const db = student()
    await assertFails(
      setDoc(doc(db, 'teachers', STUDENT), { name: '학생', createdAt: serverTimestamp() }),
    )
  })
})

describe('기준 묶음', () => {
  const sets = [{ id: 'set1', name: '말하기', criteria: [{ id: 'c1', label: '목소리' }] }]

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'teachers', TEACHER_A), { name: '박선생', createdAt: new Date() })
    })
  })

  it('교사는 자기 문서에 기준 묶음을 저장하고 지울 수 있다', async () => {
    const ref = doc(teacher(TEACHER_A), 'teachers', TEACHER_A)
    await assertSucceeds(setDoc(ref, { criteriaSets: sets }, { merge: true }))
    await assertSucceeds(setDoc(ref, { criteriaSets: [] }, { merge: true }))
  })

  it('남의 문서에는 저장할 수 없다', async () => {
    await assertFails(
      setDoc(doc(teacher(TEACHER_B), 'teachers', TEACHER_A), { criteriaSets: sets }, { merge: true }),
    )
  })

  it('묶음이 서른 개를 넘으면 거부한다', async () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ ...sets[0], id: `set${i}` }))
    await assertFails(
      setDoc(doc(teacher(TEACHER_A), 'teachers', TEACHER_A), { criteriaSets: many }, { merge: true }),
    )
  })

  it('목록이 아닌 값이나 모르는 칸은 거부한다', async () => {
    const ref = doc(teacher(TEACHER_A), 'teachers', TEACHER_A)
    await assertFails(setDoc(ref, { criteriaSets: '목록 아님' }, { merge: true }))
    await assertFails(setDoc(ref, { 관리자: true }, { merge: true }))
  })

  it('묶음을 저장하는 척 만든 시각을 바꿀 수 없다', async () => {
    await assertFails(
      setDoc(doc(teacher(TEACHER_A), 'teachers', TEACHER_A),
        { criteriaSets: sets, createdAt: new Date(2020, 0, 1) }, { merge: true }),
    )
  })
})

describe('학급', () => {
  it('교사는 자기 학급을 만들 수 있다', async () => {
    const db = teacher(TEACHER_B)
    await assertSucceeds(
      setDoc(doc(db, 'classes', 'new-class'), {
        teacherId: TEACHER_B,
        name: '4학년 1반',
        joinCode: 'QRT479',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('남의 이름으로 학급을 만들 수 없다', async () => {
    const db = teacher(TEACHER_B)
    await assertFails(
      setDoc(doc(db, 'classes', 'stolen'), {
        teacherId: TEACHER_A,
        name: '남의 반',
        joinCode: 'QRT479',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('학급 이름이 비었거나 너무 길면 거부한다', async () => {
    const db = teacher(TEACHER_B)
    await assertFails(
      setDoc(doc(db, 'classes', 'bad1'), {
        teacherId: TEACHER_B, name: '', joinCode: 'QRT479', createdAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db, 'classes', 'bad2'), {
        teacherId: TEACHER_B, name: 'ㄱ'.repeat(31), joinCode: 'QRT479', createdAt: serverTimestamp(),
      }),
    )
  })

  it('주인 교사는 이름을 고칠 수 있지만 남은 못 고친다', async () => {
    await assertSucceeds(
      setDoc(doc(teacher(TEACHER_A), 'classes', CLASS_A), { name: '3학년 3반' }, { merge: true }),
    )
    await assertFails(
      setDoc(doc(teacher(TEACHER_B), 'classes', CLASS_A), { name: '가로채기' }, { merge: true }),
    )
  })

  it('입장 코드와 주인은 수정으로 바꿀 수 없다', async () => {
    const db = teacher(TEACHER_A)
    await assertFails(
      setDoc(doc(db, 'classes', CLASS_A), { joinCode: 'ZZZZZZ' }, { merge: true }),
    )
    await assertFails(
      setDoc(doc(db, 'classes', CLASS_A), { teacherId: TEACHER_B }, { merge: true }),
    )
  })

  it('주인만 학급을 지울 수 있다', async () => {
    await assertFails(deleteDoc(doc(teacher(TEACHER_B), 'classes', CLASS_A)))
    await assertSucceeds(deleteDoc(doc(teacher(TEACHER_A), 'classes', CLASS_A)))
  })

  it('교사는 자기 학급 목록만 가져온다', async () => {
    const db = teacher(TEACHER_A)
    await assertSucceeds(
      getDocs(query(collection(db, 'classes'), where('teacherId', '==', TEACHER_A))),
    )
    // 조건 없이 전체를 훑으려 하면 거부된다
    await assertFails(getDocs(collection(db, 'classes')))
    // 남의 학급을 달라고 하면 거부된다
    await assertFails(
      getDocs(query(collection(teacher(TEACHER_B), 'classes'), where('teacherId', '==', TEACHER_A))),
    )
  })

  it('로그인하지 않은 사람은 학급을 읽지 못한다', async () => {
    await assertFails(getDoc(doc(anonymousVisitor(), 'classes', CLASS_A)))
  })

  it('학생(익명)은 학급 id를 알면 읽을 수 있지만 고치지는 못한다', async () => {
    const db = student()
    await assertSucceeds(getDoc(doc(db, 'classes', CLASS_A)))
    await assertFails(setDoc(doc(db, 'classes', CLASS_A), { name: '장난' }, { merge: true }))
    await assertFails(deleteDoc(doc(db, 'classes', CLASS_A)))
  })
})

describe('명단', () => {
  it('주인 교사는 명단을 넣을 수 있다', async () => {
    await assertSucceeds(
      setDoc(doc(teacher(TEACHER_A), 'classes', CLASS_A, 'students', 's2'), {
        number: 2, name: '이바다',
      }),
    )
  })

  it('다른 교사는 남의 명단을 건드리지 못한다', async () => {
    await assertFails(
      setDoc(doc(teacher(TEACHER_B), 'classes', CLASS_A, 'students', 's2'), {
        number: 2, name: '끼어들기',
      }),
    )
    await assertFails(deleteDoc(doc(teacher(TEACHER_B), 'classes', CLASS_A, 'students', 's1')))
  })

  it('번호와 이름이 규칙에 맞아야 한다', async () => {
    const db = teacher(TEACHER_A)
    const ref = (id: string) => doc(db, 'classes', CLASS_A, 'students', id)
    await assertFails(setDoc(ref('x1'), { number: 0, name: '영번' }))
    await assertFails(setDoc(ref('x2'), { number: 101, name: '백한번' }))
    await assertFails(setDoc(ref('x3'), { number: 1.5, name: '소수' }))
    await assertFails(setDoc(ref('x4'), { number: '3', name: '글자번호' }))
    await assertFails(setDoc(ref('x5'), { number: 3, name: '' }))
    await assertFails(setDoc(ref('x6'), { number: 3, name: '가'.repeat(21) }))
    await assertFails(setDoc(ref('x7'), { number: 3, name: '정상', 비밀: '몰래' }))
  })

  it('학생은 명단을 읽지만 고치지는 못한다', async () => {
    const db = student()
    await assertSucceeds(getDocs(collection(db, 'classes', CLASS_A, 'students')))
    await assertFails(
      setDoc(doc(db, 'classes', CLASS_A, 'students', 's9'), { number: 9, name: '내가추가' }),
    )
    await assertFails(deleteDoc(doc(db, 'classes', CLASS_A, 'students', 's1')))
  })
})

describe('입장 코드', () => {
  it('학생은 코드로 학급을 찾을 수 있다', async () => {
    const snap = await assertSucceeds(getDoc(doc(student(), 'joinCodes', CODE_A)))
    expect(snap.data()?.classId).toBe(CLASS_A)
  })

  it('코드 목록 전체를 훑을 수는 없다', async () => {
    await assertFails(getDocs(collection(student(), 'joinCodes')))
    await assertFails(getDocs(collection(teacher(TEACHER_A), 'joinCodes')))
  })

  it('학생은 코드를 만들거나 지울 수 없다', async () => {
    const db = student()
    await assertFails(setDoc(doc(db, 'joinCodes', 'NEWXYZ'), { classId: 'x', teacherId: STUDENT }))
    await assertFails(deleteDoc(doc(db, 'joinCodes', CODE_A)))
  })

  it('남의 코드는 지우지 못한다', async () => {
    await assertFails(deleteDoc(doc(teacher(TEACHER_B), 'joinCodes', CODE_A)))
    await assertSucceeds(deleteDoc(doc(teacher(TEACHER_A), 'joinCodes', CODE_A)))
  })

  it('이미 있는 코드를 덮어쓸 수 없다', async () => {
    await assertFails(
      setDoc(doc(teacher(TEACHER_B), 'joinCodes', CODE_A), {
        classId: 'other', teacherId: TEACHER_B,
      }),
    )
  })
})

describe('규칙에 없는 곳', () => {
  it('아직 만들지 않은 컬렉션은 아무도 못 쓴다', async () => {
    // results 는 4단계에서 더한다. 그 전까지는 교사도 학생도 못 쓴다.
    await assertFails(setDoc(doc(teacher(TEACHER_A), 'results', 'r1'), { x: 1 }))
    await assertFails(getDoc(doc(student(), 'results', 'r1')))
    await assertFails(setDoc(doc(teacher(TEACHER_A), '아무거나', 'x1'), { x: 1 }))
  })
})
