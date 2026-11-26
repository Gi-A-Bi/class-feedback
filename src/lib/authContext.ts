// 로그인 상태를 담는 그릇과, 화면에서 부르는 로그인/로그아웃 함수.
// 컴포넌트가 아닌 것들은 여기 둔다(auth.tsx 는 Provider만 둔다).
import { createContext, use } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getAuthClient, getDb } from './firebase'

export interface AuthState {
  /** 아직 로그인 여부를 모르는 동안 true */
  loading: boolean
  /** 로그인한 교사. 로그인 전이거나 익명(학생)이면 null */
  teacher: User | null
}

export const AuthContext = createContext<AuthState>({ loading: true, teacher: null })

export function useAuth(): AuthState {
  return use(AuthContext)
}

/** 구글 로그인 창을 띄우고, 처음이면 teachers/{uid} 문서를 만든다. */
export async function signInTeacher(selectAccount = false): Promise<void> {
  const provider = new GoogleAuthProvider()
  if (selectAccount) provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(getAuthClient(), provider)
  const user = result.user

  const ref = doc(getDb(), 'teachers', user.uid)
  const existing = await getDoc(ref)
  if (!existing.exists()) {
    await setDoc(ref, {
      name: user.displayName ?? '선생님',
      createdAt: serverTimestamp(),
    })
  }
}

export async function signOutTeacher(): Promise<void> {
  await signOut(getAuthClient())
}

