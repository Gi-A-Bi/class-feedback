// 교사 3. 진행 — 지금 발표자, 제출 현황, 이전·다음 발표자.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  deleteActivity,
  endActivity,
  goToPresentation,
  startActivity,
  watchActivity,
  watchEvaluations,
  watchPresentations,
} from '../lib/activities'
import { getClass, watchStudents } from '../lib/classes'
import type {
  ActivityWithId,
  ClassRoomWithId,
  EvaluationWithId,
  PresentationWithId,
  StudentWithId,
} from '../lib/types'
import './ActivityRun.css'

export default function ActivityRun() {
  const { activityId = '' } = useParams()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<ActivityWithId | null | 'missing'>(null)
  const [klass, setKlass] = useState<ClassRoomWithId | null>(null)
  const [presentations, setPresentations] = useState<PresentationWithId[]>([])
  const [students, setStudents] = useState<StudentWithId[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationWithId[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return watchActivity(
      activityId,
      (a) => setActivity(a ?? 'missing'),
      () => setError('활동을 불러오지 못했어요.'),
    )
  }, [activityId])

  const classId = activity && activity !== 'missing' ? activity.classId : null

  useEffect(() => {
    if (!classId) return
    getClass(classId).then(setKlass).catch(() => undefined)
    return watchStudents(classId, setStudents, () => undefined)
  }, [classId])

  useEffect(() => {
    return watchPresentations(activityId, setPresentations, () => undefined)
  }, [activityId])

  const currentId = activity && activity !== 'missing' ? activity.currentPresentationId : null

  useEffect(() => {
    if (!currentId) return
    return watchEvaluations(activityId, currentId, setEvaluations, () => undefined)
  }, [activityId, currentId])

  const nameOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.id, s]))
    return (id: string) => {
      const s = map.get(id)
      return s ? `${s.number}번 ${s.name}` : '(지워진 학생)'
    }
  }, [students])

  if (activity === 'missing') {
    return (
      <div className="card">
        <p className="empty">활동을 찾을 수 없어요.</p>
      </div>
    )
  }
  if (activity === null) return <p className="spinner">불러오는 중…</p>

  const index = currentId ? presentations.findIndex((p) => p.id === currentId) : -1
  const current = index >= 0 ? presentations[index] : null
  const prev = index > 0 ? presentations[index - 1] : undefined
  const next = index >= 0 ? presentations[index + 1] : undefined

  // 지금 발표자는 자기 평가를 하므로, 평가해야 할 사람은 명단 전체다.
  // 발표가 바뀌는 찰나에 지난 발표의 제출이 보이지 않도록 걸러 낸다.
  const submittedIds = new Set(
    evaluations.filter((e) => e.presentationId === currentId).map((e) => e.studentId),
  )
  const expected = students
  const doneCount = expected.filter((s) => submittedIds.has(s.id)).length
  const percent = expected.length ? Math.round((doneCount / expected.length) * 100) : 0

  async function run(fn: () => Promise<void>, failMessage: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError(failMessage)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="run">
      <header className="run__bar">
        <div className="run__barMain">
          <span className="run__title">{activity.title}</span>
          <span className="run__sub">
            {klass?.name ?? ''} · 개인 발표 ·{' '}
            {activity.status === 'ready' ? '준비' : activity.status === 'running' ? '진행 중' : '끝남'}
          </span>
        </div>
        {klass && (
          <span className="run__code">
            입장 코드 <strong>{klass.joinCode}</strong>
          </span>
        )}
        <span className="run__spacer" />
        <button type="button" className="btn--small run__quiet" onClick={() => navigate(`/teacher/class/${activity.classId}`)}>
          학급으로
        </button>
        <button type="button" className="btn--small run__quiet" onClick={() => navigate('/teacher')}>
          학급 목록
        </button>
      </header>

      <div className="run__body">
        <section className="run__main">
          {activity.status === 'ready' ? (
            <div className="run__ready">
              <p className="run__readyText">
                발표 {presentations.length}명이 준비됐어요. 시작하면 학생 화면에 첫 발표자가 나타납니다.
              </p>
              <button
                type="button"
                disabled={busy || presentations.length === 0}
                onClick={() =>
                  run(
                    () => startActivity(activityId, activity.classId, presentations[0].id),
                    '시작하지 못했어요.',
                  )
                }
              >
                발표 시작하기
              </button>
            </div>
          ) : activity.status === 'ended' ? (
            <div className="run__ready">
              <p className="run__readyText">활동이 끝났어요.</p>
              <p className="card__hint">결과 공개와 코멘트 검토는 다음 단계에서 만듭니다.</p>
            </div>
          ) : (
            <>
              <div className="run__nowbox">
                <span className="run__nowlabel">지금 발표</span>
                <strong className="run__nowname">
                  {current ? nameOf(current.studentIds[0]) : '-'}
                </strong>
                <span className="run__pos">
                  {index + 1} / {presentations.length}
                </span>
              </div>

              <div className="row">
                <button
                  type="button"
                  className="btn--quiet"
                  disabled={!prev || busy}
                  onClick={() => prev && run(() => goToPresentation(activityId, prev.id), '넘기지 못했어요.')}
                >
                  ← 이전 발표자
                </button>
                <button
                  type="button"
                  disabled={!next || busy}
                  onClick={() => next && run(() => goToPresentation(activityId, next.id), '넘기지 못했어요.')}
                >
                  다음 발표자 →
                </button>
                {!next && (
                  <button
                    type="button"
                    className="btn--quiet"
                    disabled={busy}
                    onClick={() => run(() => endActivity(activityId, activity.classId), '끝내지 못했어요.')}
                  >
                    활동 끝내기
                  </button>
                )}
              </div>

              <div className="run__progress">
                <div className="run__progressTop">
                  <span>제출 {doneCount}명 / {expected.length}명</span>
                  <span>{percent}%</span>
                </div>
                <div className="run__bar2">
                  <div className="run__bar2fill" style={{ width: `${percent}%` }} />
                </div>
              </div>

              <div className="run__grid">
                {expected.map((s) => {
                  const done = submittedIds.has(s.id)
                  const isPresenter = current?.studentIds.includes(s.id)
                  return (
                    <span
                      key={s.id}
                      className={`chipst${done ? ' chipst--done' : ''}${isPresenter ? ' chipst--self' : ''}`}
                      title={isPresenter ? '지금 발표자 (자기 평가)' : undefined}
                    >
                      {s.number} {s.name}
                    </span>
                  )
                })}
              </div>
            </>
          )}

          {error && <p className="msg msg--bad">{error}</p>}
        </section>

        <aside className="run__side">
          <h2 className="run__sideTitle">발표 순서</h2>
          <ol className="run__list">
            {presentations.map((p, i) => (
              <li
                key={p.id}
                className={`run__listItem${p.id === currentId ? ' run__listItem--now' : ''}`}
              >
                <span className="run__listPos">{i + 1}</span>
                <span>{nameOf(p.studentIds[0])}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn--danger btn--small"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('이 활동을 지울까요?\n학생들이 낸 평가도 함께 지워집니다.')) return
              run(async () => {
                await deleteActivity(activityId, activity.classId)
                navigate(`/teacher/class/${activity.classId}`)
              }, '지우지 못했어요.')
            }}
          >
            활동 지우기
          </button>
        </aside>
      </div>
    </div>
  )
}
