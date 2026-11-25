// 학생 2-1. 지난 평가 — 이미 지나간 발표의 평가를 고치거나, 놓친 평가를 뒤늦게 낸다.
// 선생님이 활동을 끝내기 전까지만 된다. 발표자가 바뀌면 부모가 이 화면을 닫는다.
import { useEffect, useState } from 'react'
import EvaluationForm from './EvaluationForm'
import { getMyEvaluations } from '../lib/activities'
import { presentationLabel, presentationMembers } from '../lib/groups'
import type { StudentSession } from '../lib/student'
import type { ActivityWithId, PresentationWithId } from '../lib/types'
import './StudentEvaluate.css'
import './StudentRecords.css'

interface Props {
  session: StudentSession
  activity: ActivityWithId
  /** 이미 지나간 발표들(발표 순서대로) */
  presentations: PresentationWithId[]
  nameOf: (studentId: string) => string
  onBack: () => void
}

export default function StudentPast({ session, activity, presentations, nameOf, onBack }: Props) {
  // 낸 발표의 id. null 은 아직 확인 중.
  const [doneIds, setDoneIds] = useState<Set<string> | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)

  const idsKey = presentations.map((p) => p.id).join(',')
  useEffect(() => {
    let alive = true
    const ids = idsKey ? idsKey.split(',') : []
    getMyEvaluations(activity.id, ids, session.studentId).then((map) => {
      if (!alive) return
      setDoneIds(new Set(map.keys()))
      // 처음 열 때 한 번만: 아직 안 낸 발표가 있으면 그것을, 다 냈으면 가장 최근 발표를 고른다.
      // (내고 난 뒤에 고른 발표가 저절로 바뀌면 안 된다.)
      setPickedId((prev) => prev ?? ids.find((id) => !map.has(id)) ?? ids[ids.length - 1] ?? null)
    })
    return () => {
      alive = false
    }
  }, [activity.id, idsKey, session.studentId])

  const selected = presentations.find((p) => p.id === pickedId) ?? null

  const isSelf = Boolean(selected?.studentIds.includes(session.studentId))
  const isGroup = Boolean(selected?.groupName)

  return (
    <div className={`eval${isSelf ? ' eval--self' : ''}`}>
      <header className="eval__bar">
        <span className="eval__title">지난 평가</span>
        <span className="eval__sub">{activity.title}</span>
        <span className="eval__spacer" />
        <span className="eval__me">
          {session.studentNumber}번 {session.studentName}
        </span>
        <button type="button" className="btn--small eval__out" onClick={onBack}>
          지금 발표로
        </button>
      </header>

      <div className="eval__body">
        <aside className="eval__side rec__side">
          <p className="eval__anon">
            고치고 싶은 발표를 골라요. 선생님이 활동을 끝내기 전까지 고칠 수 있어요. 다음 발표가
            시작되면 이 화면은 저절로 닫혀요.
          </p>
          <ol className="rec__list">
            {presentations.map((p, i) => {
              const mine = p.studentIds.includes(session.studentId)
              const done = doneIds?.has(p.id)
              const on = p.id === selected?.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`rec__item${on ? ' rec__item--on' : ''}`}
                    onClick={() => setPickedId(p.id)}
                    aria-current={on}
                  >
                    <span className="rec__itemTitle">
                      {i + 1}. {mine && !p.groupName ? '나의 발표' : presentationLabel(p, nameOf)}
                    </span>
                    <span className="rec__itemSub">
                      {mine ? '자기 평가 · ' : ''}
                      {doneIds === null ? '확인하고 있어요' : done ? '냈어요' : '아직 안 냈어요'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="eval__main">
          {selected ? (
            <>
              <div className="past__head">
                <strong className="past__name">
                  {isSelf && !isGroup ? '나의 발표' : presentationLabel(selected, nameOf)}
                </strong>
                <span className="eval__topic">
                  {isGroup ? `${presentationMembers(selected, nameOf)} · ` : ''}
                  {isSelf ? '스스로 돌아보는 자기 평가예요.' : '내가 누구인지는 친구에게 보이지 않아요.'}
                </span>
              </div>
              <EvaluationForm
                key={selected.id}
                activityId={activity.id}
                presentationId={selected.id}
                studentId={session.studentId}
                criteria={activity.criteria}
                isSelf={isSelf}
                hasNext
                past
                onSaved={() => setDoneIds((prev) => new Set([...(prev ?? []), selected.id]))}
              />
            </>
          ) : (
            <div className="eval__done">
              <p className="eval__doneText">불러오고 있어요…</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
