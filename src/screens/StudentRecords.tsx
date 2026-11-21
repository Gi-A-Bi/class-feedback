// 학생 3. 내 기록 — 선생님이 공개한 내 결과.
// 내 것만 보인다. 다른 친구의 점수나 순위는 어디에도 나오지 않는다.
import { useEffect, useState } from 'react'
import StarMeter from '../components/StarMeter'
import TrendChart from '../components/TrendChart'
import { overallAverage } from '../lib/results'
import { watchMyRecords, type StudentSession } from '../lib/student'
import { shortDate } from '../lib/time'
import type { StudentRecordWithId } from '../lib/types'
import './StudentEvaluate.css'
import './StudentRecords.css'

interface Props {
  session: StudentSession
  onBack: () => void
}

/** 지난번과 견주어 한 문장으로 말해 준다. */
function compareText(now: number | null, before: number | null): string | null {
  if (now === null || before === null) return null
  const diff = Math.round((now - before) * 10) / 10
  if (diff > 0) return `지난번보다 ${diff.toFixed(1)}점 올랐어요`
  if (diff < 0) return `지난번보다 ${Math.abs(diff).toFixed(1)}점 내려갔어요`
  return '지난번과 같아요'
}

export default function StudentRecords({ session, onBack }: Props) {
  const [records, setRecords] = useState<StudentRecordWithId[] | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return watchMyRecords(session.classId, session.studentId, setRecords, () =>
      setError('기록을 불러오지 못했어요.'),
    )
  }, [session.classId, session.studentId])

  const list = records ?? []
  // 고른 회차가 없거나 사라졌으면 가장 최근 회차를 보여 준다
  const selectedIndex = (() => {
    const i = list.findIndex((r) => r.id === pickedId)
    return i >= 0 ? i : list.length - 1
  })()
  const selected = selectedIndex >= 0 ? list[selectedIndex] : null
  const averages = list.map((r) => overallAverage(r.peerAverages))

  return (
    <div className="eval">
      <header className="eval__bar">
        <span className="eval__title">내 기록</span>
        <span className="eval__sub">{session.className}</span>
        <span className="eval__spacer" />
        <span className="eval__me">
          {session.studentNumber}번 {session.studentName}
        </span>
        <button type="button" className="btn--small eval__out" onClick={onBack}>
          돌아가기
        </button>
      </header>

      {records === null ? (
        <div className="eval__wait">
          <p>{error ?? '불러오고 있어요…'}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="eval__wait">
          <p>아직 볼 수 있는 기록이 없어요. 선생님이 결과를 공개하면 여기에 보여요.</p>
        </div>
      ) : (
        <div className="eval__body">
          <aside className="eval__side rec__side">
            <div className="rec__trend">
              <h2 className="rec__h">발표할 때마다 달라진 점수</h2>
              {averages.filter((v) => v !== null).length >= 2 ? (
                <TrendChart
                  values={averages}
                  selectedIndex={selectedIndex}
                  onSelect={(i) => setPickedId(list[i].id)}
                  labelOf={(i) => `${i + 1}회 ${list[i].activityTitle}`}
                />
              ) : (
                <p className="rec__hint">발표를 두 번 하면 점수가 어떻게 달라졌는지 볼 수 있어요.</p>
              )}
            </div>

            <ol className="rec__list">
              {list.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`rec__item${i === selectedIndex ? ' rec__item--on' : ''}`}
                    onClick={() => setPickedId(r.id)}
                    aria-current={i === selectedIndex}
                  >
                    <span className="rec__itemTitle">
                      {i + 1}회 · {r.activityTitle}
                    </span>
                    <span className="rec__itemSub">
                      {shortDate(r.activityCreatedAt)}
                      {r.kind === 'group' ? ' · 모둠' : ''}
                    </span>
                    <span className="rec__itemAvg">
                      {averages[i] === null ? '-' : averages[i]!.toFixed(1)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          {selected && (
            <section className="eval__main rec__main">
              <div className="rec__head">
                <h2 className="rec__title">
                  {selectedIndex + 1}회 · {selected.activityTitle}
                  {selected.kind === 'group' && <span className="rec__tag">모둠</span>}
                </h2>
                <p className="rec__sub">
                  {shortDate(selected.activityCreatedAt)} ·{' '}
                  {selected.peerCount > 0
                    ? `친구 ${selected.peerCount}명이 평가했어요`
                    : '아직 친구들의 평가가 없어요'}
                  {(() => {
                    const text = compareText(
                      averages[selectedIndex],
                      selectedIndex > 0 ? averages[selectedIndex - 1] : null,
                    )
                    return text ? ` · ${text}` : ''
                  })()}
                </p>
              </div>

              <div
                className={`rec__meters${selected.self ? '' : ' rec__meters--noself'}`}
                role="table"
                aria-label="기준별 별점"
              >
                <div className="rec__metersHead" role="row">
                  <span role="columnheader" />
                  <span role="columnheader">친구들이 준 별</span>
                  {selected.self && <span role="columnheader">내가 준 별</span>}
                </div>
                {selected.criteria.map((c) => (
                  <div key={c.id} className="rec__meterRow" role="row">
                    <span className="rec__meterLabel" role="rowheader">{c.label}</span>
                    <span role="cell">
                      <StarMeter
                        value={selected.peerAverages[c.id] ?? null}
                        label={`${c.label}, 친구들이 준 별`}
                      />
                    </span>
                    {selected.self && (
                      <span role="cell">
                        <StarMeter
                          value={selected.self.scores[c.id] ?? null}
                          label={`${c.label}, 내가 준 별`}
                        />
                      </span>
                    )}
                  </div>
                ))}
                {!selected.self && (
                  <p className="rec__hint" style={{ marginTop: 6 }}>
                    이번에는 자기 평가를 하지 않아서 내가 준 별은 없어요.
                  </p>
                )}
              </div>

              <div className="rec__comments">
                <div className="rec__col">
                  <h3 className="rec__h">친구들의 칭찬</h3>
                  {selected.praise.length === 0 ? (
                    <p className="rec__hint">적힌 칭찬이 없어요.</p>
                  ) : (
                    <ul className="rec__quotes">
                      {selected.praise.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rec__col">
                  <h3 className="rec__h">친구들의 제안</h3>
                  {selected.suggestions.length === 0 ? (
                    <p className="rec__hint">적힌 제안이 없어요.</p>
                  ) : (
                    <ul className="rec__quotes">
                      {selected.suggestions.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {selected.self && (selected.self.comment1 || selected.self.comment2) && (
                <div className="rec__self">
                  <div>
                    <h3 className="rec__h">내가 쓴 잘한 점</h3>
                    <p>{selected.self.comment1 || '쓰지 않았어요.'}</p>
                  </div>
                  <div>
                    <h3 className="rec__h">내가 쓴 다음에 고칠 점</h3>
                    <p>{selected.self.comment2 || '쓰지 않았어요.'}</p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
