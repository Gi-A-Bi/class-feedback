// 교사 문서: 저장해 둔 평가 기준 묶음.
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getDb } from './firebase'
import type { CriteriaSet, Criterion, Teacher } from './types'

/** 묶음은 많아야 이만큼. 보안 규칙에서도 같은 값을 검사한다. */
export const CRITERIA_SET_MAX = 30

export function watchCriteriaSets(
  uid: string,
  onChange: (sets: CriteriaSet[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), 'teachers', uid),
    (snap) => onChange((snap.data() as Teacher | undefined)?.criteriaSets ?? []),
    onError,
  )
}

/** 같은 이름의 묶음이 있으면 바꿔 넣고, 없으면 맨 뒤에 더한다. */
export function upsertCriteriaSet(
  sets: CriteriaSet[],
  name: string,
  criteria: Criterion[],
): CriteriaSet[] {
  const existing = sets.find((s) => s.name === name)
  if (existing) {
    return sets.map((s) => (s.id === existing.id ? { ...s, criteria } : s))
  }
  return [...sets, { id: `set${Date.now().toString(36)}`, name, criteria }]
}

async function writeSets(uid: string, displayName: string, sets: CriteriaSet[]): Promise<void> {
  const ref = doc(getDb(), 'teachers', uid)
  const snap = await getDoc(ref)
  // 교사 문서는 처음 로그인할 때 만들어지지만, 혹시 없으면 여기서 만든다.
  if (!snap.exists()) {
    await setDoc(ref, { name: displayName || '선생님', createdAt: serverTimestamp() })
  }
  await updateDoc(ref, { criteriaSets: sets })
}

export async function saveCriteriaSet(
  uid: string,
  displayName: string,
  current: CriteriaSet[],
  name: string,
  criteria: Criterion[],
): Promise<void> {
  await writeSets(uid, displayName, upsertCriteriaSet(current, name, criteria))
}

export async function deleteCriteriaSet(
  uid: string,
  displayName: string,
  current: CriteriaSet[],
  setId: string,
): Promise<void> {
  await writeSets(uid, displayName, current.filter((s) => s.id !== setId))
}
