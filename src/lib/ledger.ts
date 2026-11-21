// 학급의 누적 기록(교사용). 활동이 끝날 때 점수 요약을 한 번 적어 두고,
// 누적 기록 화면은 그 요약만 읽는다. 평가를 하나하나 다시 읽지 않기 위해서다.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { buildLedgerEntries } from './results'
import { toMillis } from './time'
import type { ActivityWithId, Evaluation, LedgerWithId, PresentationWithId } from './types'

function ledgerRef(classId: string, activityId: string) {
  return doc(getDb(), 'classes', classId, 'ledger', activityId)
}

/** 넘겨받은 평가로 요약을 적는다. */
export async function writeLedger(
  activity: ActivityWithId,
  presentations: PresentationWithId[],
  evaluations: Evaluation[],
): Promise<void> {
  await setDoc(ledgerRef(activity.classId, activity.id), {
    activityId: activity.id,
    title: activity.title,
    kind: activity.kind,
    criteria: activity.criteria,
    activityCreatedAt: activity.createdAt ?? null,
    updatedAt: serverTimestamp(),
    entries: buildLedgerEntries(activity, presentations, evaluations),
  })
}

/** 평가를 읽어 와서 요약을 적는다(활동을 끝낼 때, 빠진 기록을 채울 때). */
export async function syncLedger(
  activity: ActivityWithId,
  presentations: PresentationWithId[],
): Promise<void> {
  const snap = await getDocs(collection(getDb(), 'activities', activity.id, 'evaluations'))
  await writeLedger(activity, presentations, snap.docs.map((d) => d.data() as Evaluation))
}

export async function deleteLedger(classId: string, activityId: string): Promise<void> {
  await deleteDoc(ledgerRef(classId, activityId))
}

/** 학급의 요약들을 오래된 활동부터 차례로 지켜본다. */
export function watchLedgers(
  classId: string,
  onChange: (rows: LedgerWithId[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), 'classes', classId, 'ledger'),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerWithId)
      rows.sort((a, b) => toMillis(a.activityCreatedAt) - toMillis(b.activityCreatedAt))
      onChange(rows)
    },
    onError,
  )
}
