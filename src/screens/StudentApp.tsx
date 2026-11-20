// 학생 쪽 전체. 입장했으면 평가 화면, 아니면 입장 화면.
import { useEffect, useState } from 'react'
import StudentJoin from './StudentJoin'
import StudentEvaluate from './StudentEvaluate'
import { ensureStudentSignedIn, loadSession, type StudentSession } from '../lib/student'

export default function StudentApp() {
  const [session, setSession] = useState<StudentSession | null>(() => loadSession())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureStudentSignedIn().finally(() => setReady(true))
  }, [])

  if (!ready) return <p className="spinner">준비하고 있어요…</p>

  if (!session) {
    return <StudentJoin onJoined={() => setSession(loadSession())} />
  }

  return <StudentEvaluate session={session} onLeave={() => setSession(null)} />
}
