// 학생 2. 평가 — 지금 발표자를 평가한다.
// 내 차례에는 자기 평가로 바뀌고, 발표자가 바뀌면 화면이 저절로 넘어간다.
import { useEffect, useMemo, useState } from 'react'
import EvaluationForm from './EvaluationForm'
import { watchActivity, watchPresentations } from '../lib/activities'
import { watchStudents } from '../lib/classes'
import { clearSession, releaseStudent, watchClass, type StudentSession } from '../lib/student'
import type { ActivityWithId, PresentationWithId, StudentWithId } from '../lib/types'
import './StudentEvaluate.css'

interface Props {
  session: StudentSession
  onLeave: () => void
}

export default function StudentEvaluate({ session, onLeave }: Props) {
  const [activityId, setActivityId] = useState<string | null | 'none'>(null)
  const [activity, setActivity] = useState<ActivityWithId | null>(null)
  const [presentations, setPresentations] = useState<PresentationWithId[]>([])
  const [students, setStudents] = useState<StudentWithId[]>([])

  const [error, setError] = useState<string | null>(null)

  // 학급 문서를 보고 지금 진행 중인 활동을 찾는다
  useEffect(() => {
    return watchClass(
      session.classId,
      (c) => setActivityId(c?.currentActivityId ?? 'none'),
      () => setError('연결이 끊겼어요.'),
    )
  }, [session.classId])

  useEffect(() => {
    if (!activityId || activityId === 'none') return
    return watchActivity(activityId, setActivity, () => setError('활동을 불러오지 못했어요.'))
  }, [activityId])

  useEffect(() => {
    if (!activityId || activityId === 'none') return
    return watchPresentations(activityId, setPresentations, () => undefined)
  }, [activityId])

  useEffect(() => {
    return watchStudents(session.classId, setStudents, () => undefined)
  }, [session.classId])

  const nameOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.id, s]))
    return (id: string) => {
      const s = map.get(id)
      return s ? `${s.number}번 ${s.name}` : '발표자'
    }
  }, [students])

  const currentId = activity?.currentPresentationId ?? null
  const current = presentations.find((p) => p.id === currentId) ?? null
  const currentIndex = current ? presentations.findIndex((p) => p.id === current.id) : -1
  const next = currentIndex >= 0 ? presentations[currentIndex + 1] : undefined

  // 지금 발표자가 나인가 → 자기 평가
  const isSelf = Boolean(current?.studentIds.includes(session.studentId))

  async function handleLeave() {
    try {
      await releaseStudent(session.classId, session.studentId)
    } catch {
      // 못 놓아도 나가기는 한다
    }
    clearSession()
    onLeave()
  }

  // ── 기다리는 화면들 ────────────────────────────────────
  if (activityId === null) return <WaitScreen session={session} text="준비하고 있어요…" onLeave={handleLeave} />
  if (activityId === 'none' || !activity || activity.status !== 'running') {
    return <WaitScreen session={session} text="선생님이 시작하면 바로 보여요." onLeave={handleLeave} />
  }
  if (!current) {
    return <WaitScreen session={session} text="첫 발표를 기다리고 있어요." onLeave={handleLeave} />
  }

  const toneClass = isSelf ? ' eval--self' : ''

  return (
    <div className={`eval${toneClass}`}>
      <header className="eval__bar">
        <span className="eval__title">{activity.title}</span>
        <span className="eval__sub">{session.className}</span>
        <span className="eval__spacer" />
        <span className="eval__me">
          {session.studentNumber}번 {session.studentName}
        </span>
        <button type="button" className="btn--small eval__out" onClick={handleLeave}>
          나가기
        </button>
      </header>

      <div className="eval__body">
        <aside className="eval__side">
          <div className="eval__now">
            <span className="eval__nowlabel">{isSelf ? '지금 내 차례예요' : '지금 발표'}</span>
            <strong className="eval__nowname">
              {isSelf ? '나의 발표' : nameOf(current.studentIds[0])}
            </strong>
            {current.topic && <span className="eval__topic">{current.topic}</span>}
          </div>
          <div className="eval__next">
            <span className="eval__nowlabel">다음 발표</span>
            <span>{next ? nameOf(next.studentIds[0]) : '마지막이에요'}</span>
          </div>
          {error && <p className="eval__err">{error}</p>}
          <p className="eval__anon">
            {isSelf
              ? '내 발표를 스스로 돌아보는 칸이에요.'
              : '내가 누구인지는 친구에게 보이지 않아요. 솔직하게 써도 괜찮아요.'}
          </p>
        </aside>

        <section className="eval__main">
          <EvaluationForm
            key={current.id}
            activityId={activity.id}
            presentationId={current.id}
            studentId={session.studentId}
            criteria={activity.criteria}
            isSelf={isSelf}
            hasNext={Boolean(next)}
          />
        </section>
      </div>
    </div>
  )
}

function WaitScreen({
  session,
  text,
  onLeave,
}: {
  session: StudentSession
  text: string
  onLeave: () => void
}) {
  return (
    <div className="eval">
      <header className="eval__bar">
        <span className="eval__title">발표 평가</span>
        <span className="eval__sub">{session.className}</span>
        <span className="eval__spacer" />
        <span className="eval__me">
          {session.studentNumber}번 {session.studentName}
        </span>
        <button type="button" className="btn--small eval__out" onClick={onLeave}>
          나가기
        </button>
      </header>
      <div className="eval__wait">
        <p>{text}</p>
      </div>
    </div>
  )
}
