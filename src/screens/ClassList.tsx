import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { createClass, watchMyClasses } from '../lib/classes'
import type { ClassRoomWithId } from '../lib/types'

export default function ClassList() {
  const { teacher } = useAuth()
  const [classes, setClasses] = useState<ClassRoomWithId[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!teacher) return
    return watchMyClasses(
      teacher.uid,
      (rows) => {
        setClasses(rows)
        setError(null)
      },
      () => setError('학급을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'),
    )
  }, [teacher])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !teacher) return
    setBusy(true)
    setError(null)
    try {
      await createClass(teacher.uid, trimmed)
      setName('')
    } catch {
      setError('학급을 만들지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="card__title">학급 만들기</h2>
        <p className="card__hint">학급을 만들면 학생이 들어올 입장 코드가 함께 생깁니다.</p>
        <form onSubmit={handleCreate} className="row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 3학년 2반"
            maxLength={30}
            aria-label="학급 이름"
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="submit" disabled={busy || !name.trim()}>
            {busy ? '만드는 중…' : '만들기'}
          </button>
        </form>
        {error && <p className="msg msg--bad">{error}</p>}
      </div>

      <div className="card">
        <h2 className="card__title">내 학급</h2>
        {classes === null ? (
          <p className="card__hint">불러오는 중…</p>
        ) : classes.length === 0 ? (
          <p className="empty">아직 학급이 없어요. 위에서 하나 만들어 보세요.</p>
        ) : (
          <ul className="classlist">
            {classes.map((c) => (
              <li key={c.id} className="classlist__item">
                <Link to={`/teacher/class/${c.id}`} className="classlist__link">
                  {c.name}
                </Link>
                <span className="classlist__code">
                  입장 코드 <strong>{c.joinCode}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
