// 교사 4. 결과 — 코멘트를 살펴보고 부적절한 것을 숨긴 뒤 공개한다.
// 여기서는 누가 어떤 평가를 했는지 실명으로 보인다. 학생에게는 익명으로 나간다.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StarMeter from '../components/StarMeter'
import {
  publishResults,
  setEvaluationHidden,
  unpublishResults,
  watchActivity,
  watchAllEvaluations,
  watchPresentations,
} from '../lib/activities'
import { getClass, watchStudents } from '../lib/classes'
import { presentationLabel, presentationMembers } from '../lib/groups'
import { isSelfEvaluation, summarize } from '../lib/results'
import type {
  ActivityWithId,
  ClassRoomWithId,
  EvaluationWithId,
  PresentationWithId,
  StudentWithId,
} from '../lib/types'
import './ActivityRun.css'
import './ActivityResults.css'

export default function ActivityResults() {
  const { activityId = '' } = useParams()

  const [activity, setActivity] = useState<ActivityWithId | null | 'missing'>(null)
  const [klass, setKlass] = useState<ClassRoomWithId | null>(null)
  const [presentations, setPresentations] = useState<PresentationWithId[]>([])
  const [students, setStudents] = useState<StudentWithId[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationWithId[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  useEffect(() => {
    return watchAllEvaluations(activityId, setEvaluations, () =>
      setError('평가를 불러오지 못했어요.'),
    )
  }, [activityId])

  const nameOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.id, s]))
    return (id: string) => {
      const s = map.get(id)
      return s ? `${s.number}번 ${s.name}` : '(지워진 학생)'
    }
  }, [students])

  const numberOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.id, s.number]))
    return (id: string) => map.get(id) ?? 999
  }, [students])

  if (activity === 'missing') {
    return (
      <div className="card" style={{ margin: 24 }}>
        <p className="empty">활동을 찾을 수 없어요.</p>
      </div>
    )
  }
  if (activity === null || evaluations === null) return <p className="spinner">불러오는 중…</p>

  const published = activity.resultsPublished
  const hiddenCount = evaluations.filter((e) => e.hidden).length

  async function run(fn: () => Promise<void>, failMessage: string, doneMessage?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
      if (doneMessage) setNotice(doneMessage)
    } catch {
      setError(failMessage)
    } finally {
      setBusy(false)
    }
  }

  /** 숨김을 바꾼다. 이미 공개 중이면 학생에게 보이는 내용도 바로 고친다. */
  function toggleHidden(e: EvaluationWithId) {
    if (activity === null || activity === 'missing') return
    const current = activity
    run(
      async () => {
        await setEvaluationHidden(activityId, e.id, !e.hidden)
        if (current.resultsPublished) await publishResults(current, presentations)
      },
      '바꾸지 못했어요.',
      current.resultsPublished ? '학생에게 보이는 결과에도 바로 반영했어요.' : undefined,
    )
  }

  return (
    <div className="run">
      <header className="run__bar">
        <div className="run__barMain">
          <span className="run__title">{activity.title} · 결과</span>
          <span className="run__sub">
            {klass?.name ?? ''} · 평가 {evaluations.length}건
            {hiddenCount > 0 ? ` · 숨긴 평가 ${hiddenCount}건` : ''}
          </span>
        </div>
        <span className="run__spacer" />
        <span className="run__pub">
          {published ? '결과를 학생에게 공개 중' : '결과는 아직 학생에게 보이지 않아요'}
        </span>
        {published && (
          <button
            type="button"
            className="btn--small run__quiet"
            disabled={busy}
            title="공개한 뒤에 들어온 평가를 학생에게 보이는 결과에 반영합니다"
            onClick={() =>
              run(
                () => publishResults(activity, presentations),
                '새로 고치지 못했어요.',
                '지금 평가로 다시 계산해 공개했어요.',
              )
            }
          >
            공개 내용 새로 고침
          </button>
        )}
        <button
          type="button"
          className={`btn--small ${published ? 'run__quiet' : 'run__primary'}`}
          disabled={busy}
          onClick={() => {
            if (published) {
              if (!window.confirm('결과 공개를 취소할까요?\n학생들의 "내 기록"에서 이 활동이 사라집니다. 평가는 지워지지 않아요.')) return
              run(() => unpublishResults(activity, presentations), '공개를 취소하지 못했어요.')
            } else {
              run(
                () => publishResults(activity, presentations),
                '공개하지 못했어요.',
                '공개했어요. 학생들이 "내 기록"에서 볼 수 있습니다.',
              )
            }
          }}
        >
          {published ? '공개 취소' : '결과 공개'}
        </button>
        <Link to={`/teacher/activity/${activityId}`} className="run__link">
          진행 화면
        </Link>
        <Link to={`/teacher/class/${activity.classId}`} className="run__link">
          학급으로
        </Link>
      </header>

      <div className="results">
        <p className="results__lead">
          여기서는 누가 쓴 평가인지 이름이 보입니다. <strong>학생에게는 이름 없이</strong> 점수 평균과
          코멘트만 나갑니다. 친구에게 보이면 안 되는 코멘트는 <strong>숨기기</strong>를 눌러 주세요.
          숨긴 평가도 점수는 평균에 들어갑니다.
        </p>
        {notice && <p className="msg msg--ok">{notice}</p>}
        {error && <p className="msg msg--bad">{error}</p>}

        {presentations.map((p, i) => {
          const mine = evaluations.filter((e) => e.presentationId === p.id)
          const peers = mine
            .filter((e) => !isSelfEvaluation(e, p))
            .sort((a, b) => numberOf(a.studentId) - numberOf(b.studentId))
          const selves = mine.filter((e) => isSelfEvaluation(e, p))
          const summary = summarize(activity.criteria, p, mine)

          return (
            <section key={p.id} className="card results__card">
              <div className="results__head">
                <h2 className="card__title">
                  <span className="results__pos">{i + 1}</span>
                  {presentationLabel(p, nameOf)}
                  {p.groupName && (
                    <span className="results__members">{presentationMembers(p, nameOf)}</span>
                  )}
                </h2>
                <span className="results__count">친구 {summary.peerCount}명이 평가</span>
              </div>

              <div className="results__avgs">
                {activity.criteria.map((c) => (
                  <div key={c.id} className="results__avg">
                    <span className="results__avgLabel">{c.label}</span>
                    <StarMeter
                      value={summary.peerAverages[c.id] ?? null}
                      label={`${c.label}, 친구들 평균`}
                    />
                  </div>
                ))}
              </div>

              {mine.length === 0 ? (
                <p className="card__hint" style={{ margin: 0 }}>아직 들어온 평가가 없어요.</p>
              ) : (
                <table className="results__table">
                  <thead>
                    <tr>
                      <th>평가한 학생</th>
                      {activity.criteria.map((c) => (
                        <th key={c.id} className="results__num">{c.label}</th>
                      ))}
                      <th>칭찬 한 가지 / 잘한 점</th>
                      <th>제안 한 가지 / 다음에 고칠 점</th>
                      <th aria-label="숨기기" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...selves, ...peers].map((e) => {
                      const self = isSelfEvaluation(e, p)
                      return (
                        <tr
                          key={e.id}
                          className={`${self ? 'results__row--self' : ''}${e.hidden ? ' results__row--hidden' : ''}`}
                        >
                          <td>
                            {nameOf(e.studentId)}
                            {self && <span className="results__tag">자기 평가</span>}
                            {e.hidden && <span className="results__tag results__tag--hidden">숨김</span>}
                          </td>
                          {activity.criteria.map((c) => (
                            <td key={c.id} className="results__num">{e.scores[c.id] ?? '-'}</td>
                          ))}
                          <td className="results__comment">{e.comment1 || <span className="results__none">없음</span>}</td>
                          <td className="results__comment">{e.comment2 || <span className="results__none">없음</span>}</td>
                          <td>
                            <button
                              type="button"
                              className="btn--quiet btn--small"
                              disabled={busy || (!e.comment1 && !e.comment2)}
                              onClick={() => toggleHidden(e)}
                              aria-label={`${nameOf(e.studentId)}의 코멘트 ${e.hidden ? '다시 보이기' : '숨기기'}`}
                            >
                              {e.hidden ? '다시 보이기' : '숨기기'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
