// 교사 2. 활동 만들기 — 제목, 기준, 발표 순서.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, ShuffleIcon } from '../components/Icons'
import { createActivity } from '../lib/activities'
import { shuffle } from '../lib/results'
import { getClass, watchStudents } from '../lib/classes'
import { useAuth } from '../lib/authContext'
import { DEFAULT_CRITERIA, type ClassRoomWithId, type Criterion, type StudentWithId } from '../lib/types'

export default function ActivityNew() {
  const { classId = '' } = useParams()
  const navigate = useNavigate()
  const { teacher } = useAuth()

  const [klass, setKlass] = useState<ClassRoomWithId | null>(null)
  const [students, setStudents] = useState<StudentWithId[]>([])
  const [title, setTitle] = useState('')
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA)
  const [order, setOrder] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClass(classId).then(setKlass).catch(() => setError('학급을 불러오지 못했어요.'))
  }, [classId])

  useEffect(() => {
    return watchStudents(
      classId,
      (rows) => {
        setStudents(rows)
        setOrder((prev) => (prev.length ? prev : rows.map((s) => s.id)))
      },
      () => setError('명단을 불러오지 못했어요.'),
    )
  }, [classId])

  function move(index: number, delta: number) {
    setOrder((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeAt(index: number) {
    setOrder((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCriterion(id: string, label: string) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)))
  }

  function addCriterion() {
    setCriteria((prev) =>
      prev.length >= 8 ? prev : [...prev, { id: `c${Date.now()}`, label: '' }],
    )
  }

  function removeCriterion(id: string) {
    setCriteria((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)))
  }

  const cleanCriteria = criteria
    .map((c) => ({ ...c, label: c.label.trim() }))
    .filter((c) => c.label)
  const canSave = Boolean(title.trim()) && cleanCriteria.length > 0 && order.length > 0

  async function handleSave() {
    if (!teacher || !canSave) return
    setBusy(true)
    setError(null)
    try {
      const id = await createActivity({
        teacherId: teacher.uid,
        classId,
        title: title.trim(),
        criteria: cleanCriteria,
        studentIds: order,
      })
      navigate(`/teacher/activity/${id}`)
    } catch {
      setError('활동을 만들지 못했어요. 잠시 뒤 다시 해 주세요.')
      setBusy(false)
    }
  }

  const byId = new Map(students.map((s) => [s.id, s]))

  return (
    <>
      <div className="card">
        <h2 className="card__title">활동 만들기</h2>
        <p className="card__hint">{klass?.name ?? '학급'} · 개인 발표</p>
        <label htmlFor="title">활동 제목</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 우리 고장 소개하기"
          maxLength={50}
          style={{ width: '100%', maxWidth: 420 }}
        />
      </div>

      <div className="card">
        <h2 className="card__title">평가 기준</h2>
        <p className="card__hint">학생이 별점을 매길 항목이에요. 고치거나 더할 수 있어요.</p>
        <ul className="critlist">
          {criteria.map((c) => (
            <li key={c.id} className="critlist__item">
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateCriterion(c.id, e.target.value)}
                maxLength={20}
                aria-label="기준 이름"
              />
              <button
                type="button"
                className="btn--quiet btn--small"
                onClick={() => removeCriterion(c.id)}
                disabled={criteria.length <= 1}
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn--ghost btn--small"
          onClick={addCriterion}
          disabled={criteria.length >= 8}
        >
          기준 더하기
        </button>
      </div>

      <div className="card">
        <h2 className="card__title">발표 순서</h2>
        <p className="card__hint">
          명단 번호대로 넣어 뒀어요. 화살표로 순서를 바꾸거나 오늘 발표하지 않는 학생은 뺄 수 있어요.
          순서는 활동을 만든 뒤에도, 수업 중에도 진행 화면에서 바꿀 수 있습니다.
        </p>
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="btn--quiet btn--small"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setOrder((prev) => shuffle(prev))}
            disabled={order.length < 2}
          >
            <ShuffleIcon size={16} />
            무작위로 섞기
          </button>
          <button
            type="button"
            className="btn--quiet btn--small"
            onClick={() => setOrder(students.map((s) => s.id))}
          >
            번호순으로 되돌리기
          </button>
        </div>
        {order.length === 0 ? (
          <p className="empty">발표할 학생이 없어요. 명단을 먼저 등록해 주세요.</p>
        ) : (
          <ol className="orderlist">
            {order.map((sid, i) => {
              const s = byId.get(sid)
              return (
                <li key={sid} className="orderlist__item">
                  <span className="orderlist__pos">{i + 1}</span>
                  <span className="orderlist__name">
                    {s ? `${s.number}번 ${s.name}` : '(지워진 학생)'}
                  </span>
                  <button type="button" className="btn--quiet btn--small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="앞으로">
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" className="btn--quiet btn--small" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="뒤로">
                    <ChevronDown size={16} />
                  </button>
                  <button type="button" className="btn--danger btn--small" onClick={() => removeAt(i)}>
                    빼기
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {error && <p className="msg msg--bad">{error}</p>}

      <div className="row" style={{ marginTop: 20 }}>
        <button type="button" onClick={handleSave} disabled={!canSave || busy}>
          {busy ? '만드는 중…' : '활동 만들기'}
        </button>
        <button type="button" className="btn--quiet" onClick={() => navigate(`/teacher/class/${classId}`)}>
          취소
        </button>
      </div>
    </>
  )
}
