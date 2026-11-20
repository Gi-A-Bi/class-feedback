// 활동·발표·평가를 읽고 쓰는 곳.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getDb } from './firebase'
import {
  evaluationId,
  type Activity,
  type ActivityWithId,
  type Criterion,
  type EvaluationKind,
  type EvaluationWithId,
  type PresentationWithId,
} from './types'

/** 활동 하나와 그 발표 순서를 한 번에 만든다. */
export async function createActivity(input: {
  teacherId: string
  classId: string
  title: string
  criteria: Criterion[]
  /** 발표 차례대로 늘어놓은 학생 id */
  studentIds: string[]
}): Promise<string> {
  const db = getDb()
  const activityRef = doc(collection(db, 'activities'))

  // 발표 문서의 보안 규칙은 "이 활동의 주인인가"를 활동 문서를 읽어서 확인한다.
  // 한 묶음(batch)으로 같이 쓰면 규칙이 아직 없는 활동을 읽게 되어 거부되므로,
  // 활동을 먼저 만들고 발표를 그다음에 넣는다.
  await setDoc(activityRef, {
    classId: input.classId,
    teacherId: input.teacherId,
    title: input.title,
    kind: 'individual',
    criteria: input.criteria,
    currentPresentationId: null,
    status: 'ready',
    resultsPublished: false,
    createdAt: serverTimestamp(),
  } satisfies Record<keyof Activity, unknown>)

  const batch = writeBatch(db)
  input.studentIds.forEach((studentId, index) => {
    batch.set(doc(collection(activityRef, 'presentations')), {
      order: index + 1,
      studentIds: [studentId],
      groupName: '',
      topic: '',
    })
  })
  await batch.commit()

  return activityRef.id
}

export function watchActivitiesOfClass(
  teacherId: string,
  classId: string,
  onChange: (rows: ActivityWithId[]) => void,
  onError: (e: unknown) => void,
): () => void {
  const q = query(collection(getDb(), 'activities'), where('teacherId', '==', teacherId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ActivityWithId)
        .filter((a) => a.classId === classId)
      rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      onChange(rows)
    },
    onError,
  )
}

export function watchActivity(
  activityId: string,
  onChange: (a: ActivityWithId | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), 'activities', activityId),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as ActivityWithId) : null),
    onError,
  )
}

export function watchPresentations(
  activityId: string,
  onChange: (rows: PresentationWithId[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), 'activities', activityId, 'presentations'),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PresentationWithId)
      rows.sort((a, b) => a.order - b.order)
      onChange(rows)
    },
    onError,
  )
}

/** 활동을 시작한다. 학급 문서에도 "지금 이 활동" 이라고 적어 학생이 찾게 한다. */
export async function startActivity(
  activityId: string,
  classId: string,
  firstPresentationId: string,
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  batch.update(doc(db, 'activities', activityId), {
    status: 'running',
    currentPresentationId: firstPresentationId,
  })
  batch.update(doc(db, 'classes', classId), { currentActivityId: activityId })
  await batch.commit()
}

/** 이전·다음 발표자로 넘긴다. 넘기는 순간 학생들은 평가를 고칠 수 없게 된다. */
export async function goToPresentation(
  activityId: string,
  presentationId: string,
): Promise<void> {
  await updateDoc(doc(getDb(), 'activities', activityId), {
    currentPresentationId: presentationId,
  })
}

export async function endActivity(activityId: string, classId: string): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  batch.update(doc(db, 'activities', activityId), {
    status: 'ended',
    currentPresentationId: null,
  })
  batch.update(doc(db, 'classes', classId), { currentActivityId: null })
  await batch.commit()
}

export async function deleteActivity(activityId: string, classId: string): Promise<void> {
  const db = getDb()
  const [presentations, evaluations] = await Promise.all([
    getDocs(collection(db, 'activities', activityId, 'presentations')),
    getDocs(collection(db, 'activities', activityId, 'evaluations')),
  ])
  const batch = writeBatch(db)
  for (const d of presentations.docs) batch.delete(d.ref)
  for (const d of evaluations.docs) batch.delete(d.ref)
  batch.delete(doc(db, 'activities', activityId))
  batch.update(doc(db, 'classes', classId), { currentActivityId: null })
  await batch.commit()
}

/** 교사 화면: 지금 발표에 대해 들어온 평가를 지켜본다. */
export function watchEvaluations(
  activityId: string,
  presentationId: string,
  onChange: (rows: EvaluationWithId[]) => void,
  onError: (e: unknown) => void,
): () => void {
  const q = query(
    collection(getDb(), 'activities', activityId, 'evaluations'),
    where('presentationId', '==', presentationId),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvaluationWithId)),
    onError,
  )
}

/** 학생 화면: 내가 이 발표에 이미 쓴 평가가 있는지 본다. */
export async function getMyEvaluation(
  activityId: string,
  presentationId: string,
  studentId: string,
): Promise<EvaluationWithId | null> {
  const snap = await getDoc(
    doc(getDb(), 'activities', activityId, 'evaluations', evaluationId(presentationId, studentId)),
  )
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as EvaluationWithId
}

/** 평가를 낸다. 같은 발표에 다시 내면 덮어쓴다(교사가 넘기기 전까지만 된다). */
export async function submitEvaluation(input: {
  activityId: string
  presentationId: string
  studentId: string
  kind: EvaluationKind
  scores: Record<string, number>
  comment1: string
  comment2: string
  /** 이미 낸 적이 있으면 true. 만든 시각을 지켜야 해서 구분한다. */
  isUpdate: boolean
}): Promise<void> {
  const ref = doc(
    getDb(),
    'activities',
    input.activityId,
    'evaluations',
    evaluationId(input.presentationId, input.studentId),
  )

  if (input.isUpdate) {
    await updateDoc(ref, {
      scores: input.scores,
      comment1: input.comment1,
      comment2: input.comment2,
      updatedAt: serverTimestamp(),
    })
    return
  }

  await setDoc(ref, {
    presentationId: input.presentationId,
    studentId: input.studentId,
    kind: input.kind,
    scores: input.scores,
    comment1: input.comment1,
    comment2: input.comment2,
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
