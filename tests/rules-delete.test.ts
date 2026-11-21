/**
 * 지우기(파기) 테스트. 개인정보처리방침 제5조에 적은 대로,
 * 학급이나 학생을 지우면 딸린 데이터가 남지 않는지 실제 함수를 돌려 확인한다.
 * 보안 규칙을 켠 채로 돌리므로, 지우는 순서가 규칙에 막히지 않는지도 함께 본다.
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let testEnv: RulesTestEnvironment
let teacherDb: Firestore

// 앱 코드가 쓰는 데이터베이스를 "로그인한 교사 A"의 것으로 바꿔 끼운다.
vi.mock('../src/lib/firebase', () => ({ getDb: () => teacherDb }))

const { deleteClass, deleteStudent, replaceRoster } = await import('../src/lib/classes')

const T_A = 'teacher-a'
const T_B = 'teacher-b'

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-class-feedback',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

/** 학급 하나와 그 아래 딸린 것 전부(학생 2명, 활동 1개, 발표, 평가, 공개 결과, 누적 기록) */
async function seedClass(db: Firestore, classId: string, teacherId: string, joinCode: string) {
  await setDoc(doc(db, 'classes', classId), { teacherId, name: '3-1', joinCode, currentActivityId: null })
  await setDoc(doc(db, 'joinCodes', joinCode), { classId, teacherId })
  for (const n of [1, 2]) {
    const sid = `${classId}-stu-${n}`
    await setDoc(doc(db, 'classes', classId, 'students', sid), { number: n, name: `학생${n}` })
    await setDoc(doc(db, 'classes', classId, 'students', sid, 'records', `${classId}-act`), { peerCount: 1 })
  }
  await setDoc(doc(db, 'classes', classId, 'ledger', `${classId}-act`), { entries: {} })
  await setDoc(doc(db, 'activities', `${classId}-act`), { classId, teacherId, title: '발표', status: 'ended' })
  await setDoc(doc(db, 'activities', `${classId}-act`, 'presentations', 'p1'), { order: 1, studentIds: [`${classId}-stu-1`] })
  await setDoc(doc(db, 'activities', `${classId}-act`, 'evaluations', `p1__${classId}-stu-2`), {
    presentationId: 'p1',
    studentId: `${classId}-stu-2`,
    comment1: '좋았어요',
  })
}

async function count(db: Firestore, ...path: string[]): Promise<number> {
  return (await getDocs(collection(db, path[0], ...path.slice(1)))).size
}

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await seedClass(db, 'class-a', T_A, 'AAAAAA')
    await seedClass(db, 'class-a2', T_A, 'CCCCCC')
    await seedClass(db, 'class-b', T_B, 'DDDDDD')
  })
  teacherDb = testEnv
    .authenticatedContext(T_A, { firebase: { sign_in_provider: 'google.com' } })
    .firestore() as unknown as Firestore
})

describe('학급 지우기', () => {
  it('명단, 활동, 발표, 평가, 공개 결과, 누적 기록, 입장 코드가 모두 지워진다', async () => {
    await deleteClass('class-a', 'AAAAAA', T_A)

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      expect((await getDoc(doc(db, 'classes', 'class-a'))).exists()).toBe(false)
      expect((await getDoc(doc(db, 'joinCodes', 'AAAAAA'))).exists()).toBe(false)
      expect((await getDoc(doc(db, 'activities', 'class-a-act'))).exists()).toBe(false)
      expect(await count(db, 'classes', 'class-a', 'students')).toBe(0)
      expect(await count(db, 'classes', 'class-a', 'ledger')).toBe(0)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-1', 'records')).toBe(0)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-2', 'records')).toBe(0)
      expect(await count(db, 'activities', 'class-a-act', 'presentations')).toBe(0)
      expect(await count(db, 'activities', 'class-a-act', 'evaluations')).toBe(0)
    })
  })

  it('같은 교사의 다른 학급과 다른 교사의 학급은 그대로 남는다', async () => {
    await deleteClass('class-a', 'AAAAAA', T_A)

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      for (const id of ['class-a2', 'class-b']) {
        expect((await getDoc(doc(db, 'classes', id))).exists()).toBe(true)
        expect(await count(db, 'classes', id, 'students')).toBe(2)
        expect(await count(db, 'classes', id, 'ledger')).toBe(1)
        expect(await count(db, 'activities', `${id}-act`, 'evaluations')).toBe(1)
      }
      // 남은 두 학급의 공개 결과 4건만 있어야 한다
      expect((await getDocs(collectionGroup(db, 'records'))).size).toBe(4)
    })
  })
})

describe('학생 지우기', () => {
  it('학생을 지우면 그 학생에게 공개한 결과도 지워진다', async () => {
    await deleteStudent('class-a', 'class-a-stu-1')

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      expect((await getDoc(doc(db, 'classes', 'class-a', 'students', 'class-a-stu-1'))).exists()).toBe(false)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-1', 'records')).toBe(0)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-2', 'records')).toBe(1)
    })
  })

  it('명단을 다시 붙여넣어 빠진 학생의 공개 결과도 지워진다', async () => {
    await replaceRoster('class-a', [{ number: 1, name: '학생1' }])

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      expect(await count(db, 'classes', 'class-a', 'students')).toBe(1)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-2', 'records')).toBe(0)
      expect(await count(db, 'classes', 'class-a', 'students', 'class-a-stu-1', 'records')).toBe(1)
    })
  })
})
