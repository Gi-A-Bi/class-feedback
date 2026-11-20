import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getAuthClient } from './firebase'
import { AuthContext, type AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, teacher: null })

  useEffect(() => {
    return onAuthStateChanged(getAuthClient(), (user) => {
      // 학생은 익명 인증을 쓰므로, 익명 사용자는 교사로 치지 않는다.
      setState({ loading: false, teacher: user && !user.isAnonymous ? user : null })
    })
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}
