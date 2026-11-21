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
import { deleteLedger, writeLedger } from './ledger'
import { buildRecords, shuffle } from './results'
import { toMillis } from './time'
import {
  evaluationId,
  type Activity,
  type ActivityKind,
  type ActivityWithId,
  type Criterion,
  type EvaluationKind,
  type Evaluation,
  type EvaluationWithId,
  type PresentationWithId,
} from './types'

/** 활동 하나와 그 발표 순서를 만든다. */
export async function createActivity(input: {
  teacherId: string
  classId: string
  title: string
  kind: ActivityKind
  criteria: Criterion[]
  /**
   * 발표 차례대로 늘어놓은 발표들.
   * 개인 발표면 학생 한 명에 모둠 이름은 빈 문자열, 모둠 발표면 모둠원 여럿에 모둠 이름.
   */
  presentations: { studentIds: string[]; groupName: string }[]
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
    kind: input.kind,
    criteria: input.criteria,
    currentPresentationId: null,
    status: 'ready',
    resultsPublished: false,
    createdAt: serverTimestamp(),
  } satisfies Record<keyof Activity, unknown>)

  const batch = writeBatch(db)
  input.presentations.forEach((p, index) => {
    batch.set(doc(collection(activityRef, 'presentations')), {
      order: index + 1,
      studentIds: p.studentIds,
      groupName: p.groupName,
      topic: '',
    })
  })
  await batch.commit()

  return activityRef.id
}

/** 발표 목록을 한 번 읽는다(이전 활동의 모둠을 불러올 때). */
export async function getPresentations(activityId: string): Promise<PresentationWithId[]> {
  const snap = await getDocs(collection(getDb(), 'activities', activityId, 'presentations'))
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PresentationWithId)
  rows.sort((a, b) => a.order - b.order)
  return rows
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
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
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
  const [classSnap, activitySnap] = await Promise.all([
    getDoc(doc(db, 'classes', classId)),
    getDoc(doc(db, 'activities', activityId)),
  ])
  const published = activitySnap.data()?.resultsPublished === true
  const batch = writeBatch(db)
  for (const d of presentations.docs) {
    // 공개해 둔 결과가 있으면 학생 쪽에서도 사라지게 한다.
    // 공개한 적이 없으면 지울 것이 없으므로 건드리지 않는다.
    if (published) {
      for (const studentId of (d.data().studentIds ?? []) as string[]) {
        batch.delete(recordRef(classId, studentId, activityId))
      }
    }
    batch.delete(d.ref)
  }
  for (const d of evaluations.docs) batch.delete(d.ref)
  batch.delete(doc(db, 'activities', activityId))
  // 이 활동이 지금 진행 중인 활동일 때만 학급의 표시를 지운다
  if (classSnap.data()?.currentActivityId === activityId) {
    batch.update(doc(db, 'classes', classId), { currentActivityId: null })
  }
  await batch.commit()

  // 누적 기록에서도 뺀다. 요약이 없었을 수도 있으니 실패해도 넘어간다.
  try {
    await deleteLedger(classId, activityId)
  } catch {
    // 무시
  }
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

// ── 발표 순서 바꾸기 ─────────────────────────────────────

/** 발표 순서를 통째로 다시 매긴다. 넘겨받은 id 순서대로 1, 2, 3… 이 된다. */
export async function setPresentationOrder(
  activityId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'activities', activityId, 'presentations', id), { order: index + 1 })
  })
  await batch.commit()
}

/**
 * 순서를 무작위로 섞는다. keepFirst 개까지는 그대로 두고 그 뒤만 섞는다.
 * (수업 중에는 이미 지나간 발표와 지금 발표는 건드리지 않기 위해서다.)
 */
export function shuffledOrder(ids: string[], keepFirst: number): string[] {
  return [...ids.slice(0, keepFirst), ...shuffle(ids.slice(keepFirst))]
}

// ── 결과: 검토, 숨기기, 공개 ─────────────────────────────

function recordRef(classId: string, studentId: string, activityId: string) {
  return doc(getDb(), 'classes', classId, 'students', studentId, 'records', activityId)
}

/** 교사 화면: 활동 전체의 평가를 지켜본다(검토용). */
export function watchAllEvaluations(
  activityId: string,
  onChange: (rows: EvaluationWithId[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), 'activities', activityId, 'evaluations'),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvaluationWithId)),
    onError,
  )
}

/** 부적절한 코멘트가 든 평가를 숨기거나 다시 보이게 한다. */
export async function setEvaluationHidden(
  activityId: string,
  evaluationDocId: string,
  hidden: boolean,
): Promise<void> {
  await updateDoc(doc(getDb(), 'activities', activityId, 'evaluations', evaluationDocId), {
    hidden,
  })
}

/**
 * 결과를 공개한다. 지금 있는 평가로 학생마다 요약을 계산해 써 넣는다.
 * 이미 공개 중일 때 다시 부르면 최신 평가로 새로 계산해 덮어쓴다.
 */
export async function publishResults(
  activity: ActivityWithId,
  presentations: PresentationWithId[],
): Promise<void> {
  const db = getDb()
  const evalSnap = await getDocs(collection(db, 'activities', activity.id, 'evaluations'))
  const evaluations = evalSnap.docs.map((d) => d.data() as Evaluation)
  const records = buildRecords(activity, presentations, evaluations)

  const batch = writeBatch(db)
  for (const [studentId, body] of records) {
    batch.set(recordRef(activity.classId, studentId, activity.id), {
      ...body,
      activityId: activity.id,
      activityCreatedAt: activity.createdAt ?? null,
      publishedAt: serverTimestamp(),
    })
  }
  batch.update(doc(db, 'activities', activity.id), { resultsPublished: true })
  await batch.commit()

  // 교사용 누적 기록도 같은 평가로 맞춰 둔다. 이건 실패해도 공개 자체는 된 것이므로
  // 넘어간다(누적 기록 화면에서 빠진 활동을 다시 넣을 수 있다).
  try {
    await writeLedger(activity, presentations, evaluations)
  } catch {
    // 무시
  }
}

/** 공개를 취소한다. 학생에게 보이던 요약을 지운다. 평가 자체는 그대로 남는다. */
export async function unpublishResults(
  activity: ActivityWithId,
  presentations: PresentationWithId[],
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  for (const p of presentations) {
    for (const studentId of p.studentIds) {
      batch.delete(recordRef(activity.classId, studentId, activity.id))
    }
  }
  batch.update(doc(db, 'activities', activity.id), { resultsPublished: false })
  await batch.commit()
}
