import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { watchActivitiesOfClass } from '../lib/activities'
import { useAuth } from '../lib/authContext'
import {
  deleteClass,
  deleteStudent,
  getClass,
  parseRoster,
  renameClass,
  replaceRoster,
  watchStudents,
} from '../lib/classes'
import type { ActivityWithId, ClassRoomWithId, StudentWithId } from '../lib/types'

export default function ClassDetail() {
  const { classId = '' } = useParams()
  const navigate = useNavigate()
  const { teacher } = useAuth()
  const [activities, setActivities] = useState<ActivityWithId[]>([])

  const [klass, setKlass] = useState<ClassRoomWithId | null | 'missing'>(null)
  const [students, setStudents] = useState<StudentWithId[] | null>(null)
  const [roster, setRoster] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    let alive = true
    getClass(classId)
      .then((c) => {
        if (!alive) return
        setKlass(c ?? 'missing')
        if (c) setNewName(c.name)
      })
      .catch(() => alive && setError('학급을 불러오지 못했어요.'))
    return () => {
      alive = false
    }
  }, [classId])

  useEffect(() => {
    if (!classId) return
    return watchStudents(
      classId,
      setStudents,
      () => setError('명단을 불러오지 못했어요.'),
    )
  }, [classId])

  useEffect(() => {
    if (!teacher) return
    return watchActivitiesOfClass(teacher.uid, classId, setActivities, () => undefined)
  }, [teacher, classId])

  const preview = useMemo(() => parseRoster(roster), [roster])

  async function handleSaveRoster() {
    if (preview.students.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await replaceRoster(classId, preview.students)
      setRoster('')
    } catch {
      setError('명단을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRename() {
    const trimmed = newName.trim()
    if (!trimmed || klass === null || klass === 'missing') return
    setBusy(true)
    try {
      await renameClass(classId, trimmed)
      setKlass({ ...klass, name: trimmed })
      setRenaming(false)
    } catch {
      setError('이름을 고치지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteClass() {
    if (klass === null || klass === 'missing') return
    const ok = window.confirm(
      `"${klass.name}" 학급을 지울까요?\n명단과 입장 코드도 함께 지워집니다. 되돌릴 수 없어요.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await deleteClass(classId, klass.joinCode)
      navigate('/teacher')
    } catch {
      setError('학급을 지우지 못했어요.')
      setBusy(false)
    }
  }

  if (klass === 'missing') {
    return (
      <div className="card">
        <p className="empty">학급을 찾을 수 없어요.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn--quiet" onClick={() => navigate('/teacher')}>
            학급 목록으로
          </button>
        </div>
      </div>
    )
  }

  if (klass === null) {
    return <p className="spinner">불러오는 중…</p>
  }

  const willReplace = (students?.length ?? 0) > 0

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            {renaming ? (
              <div className="row">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={30}
                  aria-label="학급 이름"
                />
                <button type="button" className="btn--small" onClick={handleRename} disabled={busy}>
                  저장
                </button>
                <button
                  type="button"
                  className="btn--quiet btn--small"
                  onClick={() => {
                    setRenaming(false)
                    setNewName(klass.name)
                  }}
                >
                  취소
                </button>
              </div>
            ) : (
              <h2 className="card__title">{klass.name}</h2>
            )}
            <p className="card__hint" style={{ margin: '6px 0 0' }}>
              학생 {students?.length ?? 0}명
            </p>
          </div>
          {!renaming && (
            <button type="button" className="btn--quiet btn--small" onClick={() => setRenaming(true)}>
              이름 고치기
            </button>
          )}
        </div>

        <div className="codebox">
          <span className="codebox__label">학생이 넣을 입장 코드</span>
          <strong className="codebox__code">{klass.joinCode}</strong>
          <span className="codebox__hint">칠판에 적어 주세요.</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="card__title">활동</h2>
          <Link to={`/teacher/class/${classId}/new-activity`}>
            <button type="button" disabled={(students?.length ?? 0) === 0}>
              활동 만들기
            </button>
          </Link>
        </div>
        {(students?.length ?? 0) === 0 ? (
          <p className="card__hint" style={{ marginTop: 10 }}>
            명단을 먼저 등록하면 활동을 만들 수 있어요.
          </p>
        ) : activities.length === 0 ? (
          <p className="empty">아직 활동이 없어요.</p>
        ) : (
          <ul className="classlist" style={{ marginTop: 14 }}>
            {activities.map((a) => (
              <li key={a.id} className="classlist__item">
                <Link to={`/teacher/activity/${a.id}`} className="classlist__link">
                  {a.title}
                </Link>
                <span className="classlist__code">
                  {a.status === 'ready' ? '준비' : a.status === 'running' ? '진행 중' : '끝남'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">명단 붙여넣기</h2>
        <p className="card__hint">
          엑셀이나 한글에서 번호와 이름을 복사해 그대로 붙여넣으세요. 한 줄에 한 명씩이면 됩니다.
          번호가 없으면 위에서부터 1번으로 매깁니다.
        </p>
        <textarea
          value={roster}
          onChange={(e) => setRoster(e.target.value)}
          placeholder={'1\t김하늘\n2\t이바다\n3\t박나무'}
          aria-label="명단 붙여넣기"
        />

        {roster.trim() && (
          <>
            <p className="card__hint" style={{ marginTop: 14 }}>
              {preview.students.length}명을 읽었어요.
            </p>
            {preview.students.length > 0 && (
              <ul className="chips">
                {preview.students.map((s) => (
                  <li key={s.number} className="chip">
                    {s.number} {s.name}
                  </li>
                ))}
              </ul>
            )}
            {preview.problems.length > 0 && (
              <div className="msg msg--warn">
                <strong>건너뛴 줄이 있어요</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '1.2em' }}>
                  {preview.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {willReplace && preview.students.length > 0 && (
              <p className="msg msg--warn">
                지금 있는 명단 {students?.length}명은 지워지고 새 명단으로 바뀝니다.
              </p>
            )}
            <div className="row" style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSaveRoster}
                disabled={busy || preview.students.length === 0}
              >
                {busy ? '저장하는 중…' : `${preview.students.length}명 저장하기`}
              </button>
              <button type="button" className="btn--quiet" onClick={() => setRoster('')}>
                지우기
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">지금 명단</h2>
        {students === null ? (
          <p className="card__hint">불러오는 중…</p>
        ) : students.length === 0 ? (
          <p className="empty">아직 명단이 없어요. 위에 붙여넣어 주세요.</p>
        ) : (
          <ul className="roster">
            {students.map((s) => (
              <li key={s.id} className="roster__item">
                <span className="roster__num">{s.number}</span>
                <span className="roster__name">{s.name}</span>
                <button
                  type="button"
                  className="btn--danger btn--small"
                  onClick={() => deleteStudent(classId, s.id)}
                  aria-label={`${s.name} 지우기`}
                >
                  지우기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="msg msg--bad">{error}</p>}

      <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
        <button type="button" className="btn--danger" onClick={handleDeleteClass} disabled={busy}>
          이 학급 지우기
        </button>
      </div>
    </>
  )
}
