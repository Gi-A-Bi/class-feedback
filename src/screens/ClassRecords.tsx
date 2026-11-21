// 교사 4. 결과 — 학생별 누적 기록과 엑셀 내려받기.
// 활동이 끝날 때 적어 둔 점수 요약(ledger)만 읽는다. 교사만 보는 화면이라
// 학생들의 점수가 한 표에 나란히 나온다. 학생에게는 이런 화면이 없다.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StarMeter from '../components/StarMeter'
import TrendChart from '../components/TrendChart'
import { getPresentations, watchActivitiesOfClass } from '../lib/activities'
import { useAuth } from '../lib/authContext'
import { getClass, watchStudents } from '../lib/classes'
import { cumulativeSheets, downloadWorkbook } from '../lib/export'
import { syncLedger, watchLedgers } from '../lib/ledger'
import { overallAverage } from '../lib/results'
import { isoDate, shortDate } from '../lib/time'
import type { ActivityWithId, ClassRoomWithId, LedgerWithId, StudentWithId } from '../lib/types'
import './ClassRecords.css'

const fmt = (v: number | null) => (v === null ? '-' : v.toFixed(1))

export default function ClassRecords() {
  const { classId = '' } = useParams()
  const { teacher } = useAuth()

  const [klass, setKlass] = useState<ClassRoomWithId | null>(null)
  const [students, setStudents] = useState<StudentWithId[]>([])
  const [ledgers, setLedgers] = useState<LedgerWithId[] | null>(null)
  const [activities, setActivities] = useState<ActivityWithId[]>([])
  const [pickedId, setPickedId] = useState<string | null>(null)
  // 그래프에서 누른 점. 학생을 바꾸면 다시 맨 마지막 회차를 가리킨다.
  const [trendPick, setTrendPick] = useState<{ studentId: string; index: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClass(classId).then(setKlass).catch(() => setError('학급을 불러오지 못했어요.'))
    return watchStudents(classId, setStudents, () => undefined)
  }, [classId])

  useEffect(() => {
    return watchLedgers(classId, setLedgers, () =>
      setError('누적 기록을 불러오지 못했어요. 보안 규칙을 새로 올렸는지 확인해 주세요.'),
    )
  }, [classId])

  useEffect(() => {
    if (!teacher) return
    return watchActivitiesOfClass(teacher.uid, classId, setActivities, () => undefined)
  }, [teacher, classId])

  const list = useMemo(() => ledgers ?? [], [ledgers])

  // 학생마다, 활동마다의 전체 평균
  const rows = useMemo(
    () =>
      students.map((s) => {
        const perActivity = list.map((l) => {
          const entry = l.entries[s.id]
          return entry ? overallAverage(entry.peerAverages) : null
        })
        const values = perActivity.filter((v): v is number => v !== null)
        return {
          student: s,
          perActivity,
          average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
        }
      }),
    [students, list],
  )

  // 끝났는데 아직 요약이 없는 활동(이 기능이 생기기 전에 끝난 활동 등)
  const missing = activities.filter(
    (a) => a.status === 'ended' && !list.some((l) => l.id === a.id),
  )
  const runningCount = activities.filter((a) => a.status === 'running').length

  const picked = students.find((s) => s.id === pickedId) ?? null
  // 고른 학생이 발표한 활동들만
  const pickedHistory = picked
    ? list.filter((l) => l.entries[picked.id]).map((l) => ({ ledger: l, entry: l.entries[picked.id] }))
    : []

  async function fillMissing() {
    setBusy(true)
    setError(null)
    try {
      for (const a of missing) {
        await syncLedger(a, await getPresentations(a.id))
      }
    } catch {
      setError('기록에 넣지 못했어요. 보안 규칙을 새로 올렸는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      await downloadWorkbook(
        cumulativeSheets(list, students),
        `발표평가_${klass?.name ?? '학급'}_누적기록_${isoDate(Date.now())}`,
      )
    } catch {
      setError('엑셀 파일을 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 className="card__title">{klass?.name ?? '학급'} · 누적 기록</h2>
            <p className="card__hint" style={{ margin: '4px 0 0' }}>
              끝난 활동마다 학생이 친구들에게 받은 별점의 평균입니다. 선생님만 보는 화면이에요.
            </p>
          </div>
          <div className="row">
            <button type="button" onClick={handleDownload} disabled={busy || list.length === 0}>
              엑셀로 내려받기
            </button>
            <Link to={`/teacher/class/${classId}`}>
              <button type="button" className="btn--quiet">학급으로</button>
            </Link>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="msg msg--warn">
            끝난 활동 가운데 아직 누적 기록에 들어가지 않은 것이 {missing.length}개 있어요:{' '}
            {missing.map((a) => a.title).join(', ')}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn--small" onClick={fillMissing} disabled={busy}>
                {busy ? '넣는 중…' : '기록에 넣기'}
              </button>
            </div>
          </div>
        )}
        {runningCount > 0 && (
          <p className="card__hint" style={{ margin: '12px 0 0' }}>
            진행 중인 활동 {runningCount}개는 끝낸 뒤에 여기에 들어옵니다.
          </p>
        )}
        {error && <p className="msg msg--bad">{error}</p>}
      </div>

      <div className="card">
        {ledgers === null ? (
          <p className="card__hint" style={{ margin: 0 }}>불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="empty">아직 끝난 활동이 없어요. 활동을 끝내면 여기에 학생별 기록이 쌓입니다.</p>
        ) : (
          <>
            <p className="card__hint">이름을 누르면 그 학생의 기록을 아래에서 자세히 볼 수 있어요.</p>
            <div className="crec__scroll">
              <table className="crec__table">
                <thead>
                  <tr>
                    <th className="crec__name">학생</th>
                    {list.map((l) => (
                      <th key={l.id} className="crec__num">
                        <span className="crec__actTitle">{l.title}</span>
                        <span className="crec__actSub">
                          {shortDate(l.activityCreatedAt)}
                          {l.kind === 'group' ? ' · 모둠' : ''}
                        </span>
                      </th>
                    ))}
                    <th className="crec__num">평균</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ student: s, perActivity, average }) => (
                    <tr key={s.id} className={s.id === pickedId ? 'crec__row--on' : ''}>
                      <th className="crec__name" scope="row">
                        <button
                          type="button"
                          className="crec__pick"
                          onClick={() => setPickedId(s.id === pickedId ? null : s.id)}
                          aria-pressed={s.id === pickedId}
                        >
                          {s.number}번 {s.name}
                        </button>
                      </th>
                      {perActivity.map((v, i) => (
                        <td key={list[i].id} className="crec__num">
                          {fmt(v)}
                        </td>
                      ))}
                      <td className="crec__num crec__avg">{fmt(average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {picked && (
        <div className="card">
          <h2 className="card__title">
            {picked.number}번 {picked.name}의 기록
          </h2>
          {pickedHistory.length === 0 ? (
            <p className="card__hint" style={{ margin: '6px 0 0' }}>아직 발표한 활동이 없어요.</p>
          ) : (
            <>
              {pickedHistory.filter((h) => overallAverage(h.entry.peerAverages) !== null).length >= 2 && (
                <div className="crec__trend">
                  <p className="card__hint" style={{ margin: '6px 0 4px' }}>발표할 때마다 달라진 평균</p>
                  <TrendChart
                    values={pickedHistory.map((h) => overallAverage(h.entry.peerAverages))}
                    selectedIndex={
                      trendPick?.studentId === picked.id ? trendPick.index : pickedHistory.length - 1
                    }
                    onSelect={(index) => setTrendPick({ studentId: picked.id, index })}
                    labelOf={(i) => `${i + 1}회 ${pickedHistory[i].ledger.title}`}
                  />
                </div>
              )}
              <ol className="crec__history">
                {pickedHistory.map(({ ledger: l, entry }, i) => (
                  <li key={l.id} className="crec__item">
                    <div className="crec__itemHead">
                      <strong>
                        {i + 1}회 · {l.title}
                      </strong>
                      <span className="crec__itemSub">
                        {shortDate(l.activityCreatedAt)} · {l.kind === 'group' ? `모둠(${entry.groupName})` : '개인'} ·
                        친구 {entry.peerCount}명이 평가
                      </span>
                    </div>
                    <div className="crec__meters">
                      <div className="crec__metersHead">
                        <span />
                        <span>친구들 평균</span>
                        <span>자기 평가</span>
                      </div>
                      {l.criteria.map((c) => (
                        <div key={c.id} className="crec__meterRow">
                          <span>{c.label}</span>
                          <StarMeter value={entry.peerAverages[c.id] ?? null} size={18} label={`${c.label}, 친구들 평균`} />
                          {entry.selfScores ? (
                            <StarMeter value={entry.selfScores[c.id] ?? null} size={18} label={`${c.label}, 자기 평가`} />
                          ) : (
                            <span className="crec__itemSub">하지 않음</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </>
  )
}
