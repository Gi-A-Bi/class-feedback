// 교사 3. 진행 — 지금 발표자, 제출 현황, 이전·다음 발표자.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, ShuffleIcon } from '../components/Icons'
import {
  deleteActivity,
  endActivity,
  goToPresentation,
  publishResults,
  setPresentationOrder,
  shuffledOrder,
  startActivity,
  unpublishResults,
  watchActivity,
  watchEvaluations,
  watchPresentations,
} from '../lib/activities'
import { getClass, releaseClaim, watchStudents } from '../lib/classes'
import { presentationLabel, presentationMembers } from '../lib/groups'
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
            {klass?.name ?? ''} · {activity.kind === 'group' ? '모둠 발표' : '개인 발표'} ·{' '}
            {activity.status === 'ready' ? '준비' : activity.status === 'running' ? '진행 중' : '끝남'}
          </span>
        </div>
        {klass && (
          <span className="run__code">
            입장 코드 <strong>{klass.joinCode}</strong>
          </span>
        )}
        <span className="run__spacer" />
        <span className="run__pub">
          {activity.resultsPublished ? '결과를 학생에게 공개 중' : '결과는 아직 학생에게 보이지 않아요'}
        </span>
        <Link to={`/teacher/activity/${activityId}/results`} className="run__link">
          결과 보기
        </Link>
        <button
          type="button"
          className={`btn--small ${activity.resultsPublished ? 'run__quiet' : 'run__primary'}`}
          disabled={busy}
          onClick={() => {
            if (activity.resultsPublished) {
              if (!window.confirm('결과 공개를 취소할까요?\n학생들의 "내 기록"에서 이 활동이 사라집니다. 평가는 지워지지 않아요.')) return
              run(() => unpublishResults(activity, presentations), '공개를 취소하지 못했어요.')
            } else {
              if (!window.confirm('결과를 공개할까요?\n학생들이 "내 기록"에서 자기 결과를 보게 됩니다.\n\n코멘트를 먼저 살펴보려면 취소를 누르고 "결과 보기"로 가세요.')) return
              run(() => publishResults(activity, presentations), '공개하지 못했어요.')
            }
          }}
        >
          {activity.resultsPublished ? '공개 취소' : '결과 공개'}
        </button>
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
                {activity.kind === 'group' ? `${presentations.length}개 모둠` : `발표 ${presentations.length}명`}이 준비됐어요. 시작하면 학생
                화면에 첫 발표가 나타납니다.
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
              <Link to={`/teacher/activity/${activityId}/results`}>
                <button type="button">결과 보고 코멘트 살펴보기</button>
              </Link>
            </div>
          ) : (
            <>
              <div className="run__nowbox">
                <span className="run__nowlabel">지금 발표</span>
                <strong className="run__nowname">
                  {current ? presentationLabel(current, nameOf) : '-'}
                </strong>
                {current && presentationMembers(current, nameOf) && (
                  <span className="run__members">{presentationMembers(current, nameOf)}</span>
                )}
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
                  const joined = Boolean(s.claimedBy)
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`chipst${done ? ' chipst--done' : ''}${isPresenter ? ' chipst--self' : ''}${joined ? '' : ' chipst--away'}`}
                      title={
                        joined
                          ? '누르면 이 학생의 기기 연결을 풉니다'
                          : '아직 들어오지 않았어요'
                      }
                      disabled={!joined || busy}
                      onClick={() => {
                        if (!window.confirm(`${s.number}번 ${s.name}의 기기 연결을 풀까요?\n그 태블릿은 입장 화면으로 돌아가고, 이름을 다시 고를 수 있게 됩니다.`)) return
                        run(() => releaseClaim(activity.classId, s.id), '풀지 못했어요.')
                      }}
                    >
                      {s.number} {s.name}
                      {!joined && <span className="chipst__away">미입장</span>}
                    </button>
                  )
                })}
              </div>
              <p className="run__hint">
                이름을 잘못 고른 학생이 있으면 그 이름을 눌러 기기 연결을 풀어 주세요. 흐린 칸은 아직
                들어오지 않은 학생입니다.
              </p>
            </>
          )}

          {error && <p className="msg msg--bad">{error}</p>}
        </section>

        <aside className="run__side">
          <div className="run__sideHead">
            <h2 className="run__sideTitle">발표 순서</h2>
            {activity.status !== 'ended' && presentations.length > 1 && (
              <button
                type="button"
                className="btn--quiet btn--small run__shuffle"
                disabled={busy || index >= presentations.length - 2}
                title={
                  activity.status === 'running'
                    ? '지금 발표 뒤의 순서만 무작위로 섞습니다'
                    : '발표 순서를 무작위로 섞습니다'
                }
                onClick={() => {
                  const ids = presentations.map((p) => p.id)
                  // 수업 중에는 지나간 발표와 지금 발표는 그대로 두고 그 뒤만 섞는다
                  const keep = activity.status === 'running' ? index + 1 : 0
                  run(() => setPresentationOrder(activityId, shuffledOrder(ids, keep)), '섞지 못했어요.')
                }}
              >
                <ShuffleIcon size={16} />
                {activity.status === 'running' ? '남은 순서 섞기' : '무작위로 섞기'}
              </button>
            )}
          </div>
          <ol className="run__list">
            {presentations.map((p, i) => {
              const isNow = p.id === currentId
              const move = (delta: number) => {
                const ids = presentations.map((x) => x.id)
                const target = i + delta
                if (target < 0 || target >= ids.length) return
                ;[ids[i], ids[target]] = [ids[target], ids[i]]
                run(() => setPresentationOrder(activityId, ids), '순서를 바꾸지 못했어요.')
              }
              return (
                <li key={p.id} className={`run__listItem${isNow ? ' run__listItem--now' : ''}`}>
                  <span className="run__listPos">{i + 1}</span>
                  {activity.status === 'running' && !isNow ? (
                    <button
                      type="button"
                      className="run__jump"
                      disabled={busy}
                      title={presentationMembers(p, nameOf) || '이 발표로 바로 넘어갑니다'}
                      onClick={() => {
                        if (!window.confirm(`${presentationLabel(p, nameOf)}의 발표로 바로 넘어갈까요?`)) return
                        run(() => goToPresentation(activityId, p.id), '넘기지 못했어요.')
                      }}
                    >
                      {presentationLabel(p, nameOf)}
                      {p.groupName && <span className="run__listSub">{p.studentIds.length}명</span>}
                    </button>
                  ) : (
                    <span className="run__listName" title={presentationMembers(p, nameOf) || undefined}>
                      {presentationLabel(p, nameOf)}
                      {p.groupName && <span className="run__listSub">{p.studentIds.length}명</span>}
                    </span>
                  )}
                  {activity.status !== 'ended' && (
                    <>
                      <button
                        type="button"
                        className="run__move"
                        disabled={busy || i === 0}
                        onClick={() => move(-1)}
                        aria-label={`${presentationLabel(p, nameOf)} 순서를 앞으로`}
                      >
                        <ChevronUp />
                      </button>
                      <button
                        type="button"
                        className="run__move"
                        disabled={busy || i === presentations.length - 1}
                        onClick={() => move(1)}
                        aria-label={`${presentationLabel(p, nameOf)} 순서를 뒤로`}
                      >
                        <ChevronDown />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ol>
          {activity.status === 'running' && (
            <p className="run__hint" style={{ marginBottom: 14 }}>
              이름을 누르면 그 발표로 바로 넘어가고, 화살표로 순서를 바꿉니다.
            </p>
          )}
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
