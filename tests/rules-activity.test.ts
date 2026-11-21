/**
 * 3단계 보안 규칙 테스트: 활동, 발표, 평가.
 * 기획 문서의 "보안 규칙 요구사항" 중 평가 관련 항목을 확인한다.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch as writeBatchOf,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

const T_A = 'teacher-a'
const T_B = 'teacher-b'
const UID_1 = 'anon-uid-1' // 1번 김하늘이 쓰는 기기
const UID_2 = 'anon-uid-2' // 2번 이바다가 쓰는 기기
const UID_X = 'anon-uid-x' // 아무 이름도 고르지 않은 기기
const CLASS = 'class-a'
const ACT = 'act-1'
const P1 = 'pres-1' // 지금 발표 (3번 박나무가 발표)
const P2 = 'pres-2' // 다음 발표
const S1 = 'stu-1'
const S2 = 'stu-2'
const S3 = 'stu-3'

function teacher(uid: string) {
  return testEnv
    .authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } })
    .firestore()
}
function student(uid: string) {
  return testEnv
    .authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } })
    .firestore()
}

/** 올바른 동료 평가 한 건 */
function peerEval(studentId: string, presentationId = P1) {
  return {
    presentationId,
    studentId,
    kind: 'peer',
    scores: { content: 4, delivery: 5, material: 3 },
    comment1: '목소리가 또렷했어요',
    comment2: '자료를 조금 더 크게 하면 좋겠어요',
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

const evalRef = (db: ReturnType<typeof student>, presentationId: string, studentId: string) =>
  doc(db, 'activities', ACT, 'evaluations', `${presentationId}__${studentId}`)

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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'classes', CLASS), {
      teacherId: T_A,
      name: '3학년 2반',
      joinCode: 'ABC234',
      currentActivityId: ACT,
      createdAt: new Date(),
    })
    // 1번과 2번은 이미 자기 이름을 골랐고, 3번은 아직 아무도 안 골랐다
    await setDoc(doc(db, 'classes', CLASS, 'students', S1), {
      number: 1, name: '김하늘', claimedBy: UID_1, claimedAt: new Date(),
    })
    await setDoc(doc(db, 'classes', CLASS, 'students', S2), {
      number: 2, name: '이바다', claimedBy: UID_2, claimedAt: new Date(),
    })
    await setDoc(doc(db, 'classes', CLASS, 'students', S3), { number: 3, name: '박나무' })
    await setDoc(doc(db, 'activities', ACT), {
      classId: CLASS,
      teacherId: T_A,
      title: '우리 고장 소개하기',
      kind: 'individual',
      criteria: [
        { id: 'content', label: '내용' },
        { id: 'delivery', label: '전달' },
        { id: 'material', label: '자료' },
      ],
      currentPresentationId: P1,
      status: 'running',
      resultsPublished: false,
      createdAt: new Date(),
    })
    await setDoc(doc(db, 'activities', ACT, 'presentations', P1), {
      order: 1, studentIds: [S3], groupName: '', topic: '우리 동네 시장',
    })
    await setDoc(doc(db, 'activities', ACT, 'presentations', P2), {
      order: 2, studentIds: [S1], groupName: '', topic: '우리 동네 도서관',
    })
  })
})

describe('이름 고르기', () => {
  it('아무도 안 고른 이름은 고를 수 있다', async () => {
    await assertSucceeds(
      updateDoc(doc(student(UID_X), 'classes', CLASS, 'students', S3), {
        claimedBy: UID_X, claimedAt: serverTimestamp(),
      }),
    )
  })

  it('남이 이미 고른 이름은 뺏을 수 없다', async () => {
    await assertFails(
      updateDoc(doc(student(UID_X), 'classes', CLASS, 'students', S1), {
        claimedBy: UID_X, claimedAt: serverTimestamp(),
      }),
    )
  })

  it('내가 고른 이름은 스스로 놓을 수 있다', async () => {
    await assertSucceeds(
      updateDoc(doc(student(UID_1), 'classes', CLASS, 'students', S1), {
        claimedBy: null, claimedAt: null,
      }),
    )
  })

  it('이름 고르는 척하며 번호나 이름을 바꿀 수 없다', async () => {
    await assertFails(
      updateDoc(doc(student(UID_X), 'classes', CLASS, 'students', S3), {
        claimedBy: UID_X, claimedAt: serverTimestamp(), name: '내가바꾼이름',
      }),
    )
    await assertFails(
      updateDoc(doc(student(UID_1), 'classes', CLASS, 'students', S1), { number: 99 }),
    )
  })

  it('교사는 고른 이름을 풀어 줄 수 있다(앱이 쓰는 방식: 두 칸을 비운다)', async () => {
    await assertSucceeds(
      updateDoc(doc(teacher(T_A), 'classes', CLASS, 'students', S1), {
        claimedBy: null, claimedAt: null,
      }),
    )
    // 풀린 이름은 다른 기기가 다시 고를 수 있다
    await assertSucceeds(
      updateDoc(doc(student(UID_X), 'classes', CLASS, 'students', S1), {
        claimedBy: UID_X, claimedAt: serverTimestamp(),
      }),
    )
  })

  it('다른 반 교사는 남의 반 학생의 고름을 풀 수 없다', async () => {
    await assertFails(
      updateDoc(doc(teacher(T_B), 'classes', CLASS, 'students', S1), {
        claimedBy: null, claimedAt: null,
      }),
    )
  })

  it('이름이 풀린 기기는 더 이상 그 이름으로 평가를 낼 수 없다', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'classes', CLASS, 'students', S1), {
        claimedBy: null, claimedAt: null,
      })
    })
    await assertFails(setDoc(evalRef(student(UID_1), P1, S1), peerEval(S1)))
  })

  it('교사는 남이 고른 것을 풀어 줄 수 있다', async () => {
    await assertSucceeds(
      setDoc(doc(teacher(T_A), 'classes', CLASS, 'students', S1), {
        number: 1, name: '김하늘',
      }),
    )
  })
})

describe('활동', () => {
  it('학생은 활동을 id로 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(student(UID_1), 'activities', ACT)))
  })

  it('학생은 활동을 고치거나 지울 수 없다', async () => {
    await assertFails(
      updateDoc(doc(student(UID_1), 'activities', ACT), { currentPresentationId: P2 }),
    )
  })

  it('다른 교사는 남의 활동을 고칠 수 없다', async () => {
    await assertFails(
      updateDoc(doc(teacher(T_B), 'activities', ACT), { title: '가로채기' }),
    )
  })

  it('주인 교사는 발표자를 넘길 수 있다', async () => {
    await assertSucceeds(
      updateDoc(doc(teacher(T_A), 'activities', ACT), { currentPresentationId: P2 }),
    )
  })

  it('남의 이름으로 활동을 만들 수 없다', async () => {
    await assertFails(
      setDoc(doc(teacher(T_B), 'activities', 'act-2'), {
        classId: CLASS, teacherId: T_A, title: '남의 활동', kind: 'individual',
        criteria: [{ id: 'content', label: '내용' }],
        currentPresentationId: null, status: 'ready', resultsPublished: false,
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('활동과 발표를 한 묶음으로 쓰면 거부된다(발표 규칙이 아직 없는 활동을 읽으므로)', async () => {
    const db = teacher(T_B)
    const ref = doc(db, 'activities', 'act-batch')
    const batch = writeBatchOf(db)
    batch.set(ref, {
      classId: CLASS, teacherId: T_B, title: '한 묶음', kind: 'individual',
      criteria: [{ id: 'content', label: '내용' }],
      currentPresentationId: null, status: 'ready', resultsPublished: false,
      createdAt: serverTimestamp(),
    })
    batch.set(doc(collection(ref, 'presentations')), {
      order: 1, studentIds: [S1], groupName: '', topic: '',
    })
    await assertFails(batch.commit())
  })

  it('활동을 먼저 만들고 발표를 넣으면 된다(앱이 쓰는 방식)', async () => {
    const db = teacher(T_B)
    const ref = doc(db, 'activities', 'act-ok')
    await assertSucceeds(
      setDoc(ref, {
        classId: CLASS, teacherId: T_B, title: '두 번에 나눠', kind: 'individual',
        criteria: [{ id: 'content', label: '내용' }],
        currentPresentationId: null, status: 'ready', resultsPublished: false,
        createdAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      setDoc(doc(collection(ref, 'presentations'), 'p1'), {
        order: 1, studentIds: [S1], groupName: '', topic: '',
      }),
    )
  })

  it('만들 때 결과 공개를 켠 채로 시작할 수 없다', async () => {
    await assertFails(
      setDoc(doc(teacher(T_B), 'activities', 'act-3'), {
        classId: CLASS, teacherId: T_B, title: '활동', kind: 'individual',
        criteria: [{ id: 'content', label: '내용' }],
        currentPresentationId: null, status: 'ready', resultsPublished: true,
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe('발표 순서', () => {
  it('학생은 발표 목록을 읽을 수 있다', async () => {
    await assertSucceeds(getDocs(collection(student(UID_1), 'activities', ACT, 'presentations')))
  })

  it('학생은 발표를 고칠 수 없다', async () => {
    await assertFails(
      updateDoc(doc(student(UID_1), 'activities', ACT, 'presentations', P1), { topic: '바꿈' }),
    )
  })

  it('다른 교사는 남의 발표를 고칠 수 없다', async () => {
    await assertFails(
      updateDoc(doc(teacher(T_B), 'activities', ACT, 'presentations', P1), { topic: '바꿈' }),
    )
  })
})

describe('평가 쓰기', () => {
  it('이름을 고른 학생은 지금 발표를 평가할 수 있다', async () => {
    await assertSucceeds(
      setDoc(evalRef(student(UID_1), P1, S1), peerEval(S1)),
    )
  })

  it('남의 이름으로 평가를 쓸 수 없다', async () => {
    // UID_1 기기가 2번 이바다인 척한다
    await assertFails(setDoc(evalRef(student(UID_1), P1, S2), peerEval(S2)))
  })

  it('아무 이름도 안 고른 기기는 평가할 수 없다', async () => {
    await assertFails(setDoc(evalRef(student(UID_X), P1, S1), peerEval(S1)))
  })

  it('문서 id가 내용과 다르면 거부한다', async () => {
    const db = student(UID_1)
    await assertFails(
      setDoc(doc(db, 'activities', ACT, 'evaluations', 'aslkdj'), peerEval(S1)),
    )
  })

  it('지금 발표가 아닌 발표에는 쓸 수 없다', async () => {
    await assertFails(setDoc(evalRef(student(UID_1), P2, S1), peerEval(S1, P2)))
  })

  it('교사가 넘긴 뒤에는 고칠 수 없다', async () => {
    const db = student(UID_1)
    await assertSucceeds(setDoc(evalRef(db, P1, S1), peerEval(S1)))
    // 교사가 다음 발표자로 넘긴다
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'activities', ACT), { currentPresentationId: P2 })
    })
    await assertFails(
      updateDoc(evalRef(db, P1, S1), {
        scores: { content: 1, delivery: 1, material: 1 },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('넘기기 전에는 고칠 수 있다', async () => {
    const db = student(UID_1)
    await assertSucceeds(setDoc(evalRef(db, P1, S1), peerEval(S1)))
    await assertSucceeds(
      updateDoc(evalRef(db, P1, S1), {
        scores: { content: 5, delivery: 5, material: 5 },
        comment1: '다시 생각해 보니 아주 좋았어요',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('활동이 진행 중이 아니면 쓸 수 없다', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'activities', ACT), { status: 'ended' })
    })
    await assertFails(setDoc(evalRef(student(UID_1), P1, S1), peerEval(S1)))
  })
})

describe('평가 내용 검사', () => {
  const bad = (patch: Record<string, unknown>) => ({ ...peerEval(S1), ...patch })

  it('점수는 1~5 정수여야 한다', async () => {
    const db = student(UID_1)
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ scores: { content: 0, delivery: 3, material: 3 } })))
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ scores: { content: 6, delivery: 3, material: 3 } })))
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ scores: { content: 3.5, delivery: 3, material: 3 } })))
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ scores: { content: '5', delivery: 3, material: 3 } })))
  })

  it('기준 수가 맞아야 한다', async () => {
    const db = student(UID_1)
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ scores: { content: 4 } })))
    await assertFails(
      setDoc(evalRef(db, P1, S1), bad({
        scores: { content: 4, delivery: 4, material: 4, extra: 4 },
      })),
    )
  })

  it('코멘트는 200자까지다', async () => {
    const db = student(UID_1)
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ comment1: '가'.repeat(201) })))
    await assertFails(setDoc(evalRef(db, P1, S1), bad({ comment2: '가'.repeat(201) })))
    await assertSucceeds(setDoc(evalRef(db, P1, S1), bad({ comment1: '가'.repeat(200) })))
  })

  it('코멘트는 비워 둘 수 있다', async () => {
    await assertSucceeds(
      setDoc(evalRef(student(UID_1), P1, S1), bad({ comment1: '', comment2: '' })),
    )
  })

  it('숨김 표시를 켠 채로 낼 수 없다', async () => {
    await assertFails(setDoc(evalRef(student(UID_1), P1, S1), bad({ hidden: true })))
  })

  it('모르는 칸을 끼워 넣을 수 없다', async () => {
    await assertFails(
      setDoc(evalRef(student(UID_1), P1, S1), bad({ 몰래: '넣기' })),
    )
  })
})

describe('평가 읽기', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'activities', ACT, 'evaluations', `${P1}__${S1}`), {
        ...peerEval(S1), createdAt: new Date(), updatedAt: new Date(),
      })
      await setDoc(doc(db, 'activities', ACT, 'evaluations', `${P1}__${S2}`), {
        ...peerEval(S2), createdAt: new Date(), updatedAt: new Date(),
      })
    })
  })

  it('학생은 자기가 쓴 평가만 읽는다', async () => {
    await assertSucceeds(getDoc(evalRef(student(UID_1), P1, S1)))
    await assertFails(getDoc(evalRef(student(UID_1), P1, S2)))
  })

  it('학생은 평가 목록을 훑을 수 없다', async () => {
    await assertFails(getDocs(collection(student(UID_1), 'activities', ACT, 'evaluations')))
  })

  it('교사는 자기 활동의 평가를 모두 읽는다', async () => {
    await assertSucceeds(getDocs(collection(teacher(T_A), 'activities', ACT, 'evaluations')))
  })

  it('다른 교사는 남의 활동 평가를 읽을 수 없다', async () => {
    await assertFails(getDocs(collection(teacher(T_B), 'activities', ACT, 'evaluations')))
    await assertFails(getDoc(evalRef(teacher(T_B), P1, S1)))
  })
})
