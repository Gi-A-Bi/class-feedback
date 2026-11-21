// 학생 1. 입장 — 학급 코드를 넣고 명단에서 자기 이름을 고른다.
import { useEffect, useState } from 'react'
import { isValidJoinCodeShape, normalizeJoinCode } from '../lib/joinCode'
import { watchStudents } from '../lib/classes'
import { claimStudent, ensureStudentSignedIn, findClassByJoinCode, saveSession } from '../lib/student'
import type { ClassRoomWithId, StudentWithId } from '../lib/types'
import './StudentJoin.css'

interface Props {
  onJoined: () => void
}

export default function StudentJoin({ onJoined }: Props) {
  const [code, setCode] = useState('')
  const [klass, setKlass] = useState<ClassRoomWithId | null>(null)
  const [students, setStudents] = useState<StudentWithId[] | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureStudentSignedIn()
      .then(setUid)
      .catch(() => setError('연결하지 못했어요. 선생님께 말씀드려 주세요.'))
  }, [])

  useEffect(() => {
    if (!klass) return
    return watchStudents(klass.id, setStudents, () =>
      setError('명단을 불러오지 못했어요.'),
    )
  }, [klass])

  async function handleFindClass(event: React.FormEvent) {
    event.preventDefault()
    const normalized = normalizeJoinCode(code)
    if (!isValidJoinCodeShape(normalized)) {
      setError('코드는 6글자예요. 칠판을 다시 봐 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const found = await findClassByJoinCode(normalized)
      if (!found) {
        setError('그런 코드가 없어요. 다시 넣어 볼까요?')
        return
      }
      setKlass(found)
    } catch {
      setError('찾지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePick(student: StudentWithId) {
    if (!klass) return
    setBusy(true)
    setError(null)
    try {
      await claimStudent(klass.id, student.id)
      saveSession({
        classId: klass.id,
        className: klass.name,
        studentId: student.id,
        studentNumber: student.number,
        studentName: student.name,
      })
      onJoined()
    } catch {
      setError('지금은 고를 수 없어요. 선생님께 말씀드려 주세요.')
      setBusy(false)
    }
  }

  if (!klass) {
    return (
      <main className="join">
        <form className="join__card" onSubmit={handleFindClass}>
          <h1 className="join__title">발표 평가</h1>
          <p className="join__lead">칠판에 적힌 코드를 넣어 주세요.</p>
          <input
            className="join__code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC234"
            maxLength={10}
            aria-label="학급 코드"
          />
          <button type="submit" disabled={busy || !code.trim() || !uid}>
            {busy ? '찾는 중…' : '들어가기'}
          </button>
          {error && <p className="join__error">{error}</p>}
          <p className="join__links">
            <a href="/teacher">선생님이신가요?</a>
            <a href="/privacy.html">개인정보처리방침</a>
          </p>
        </form>
      </main>
    )
  }

  return (
    <main className="join">
      <div className="join__card join__card--wide">
        <h1 className="join__title">{klass.name}</h1>
        <p className="join__lead">내 이름을 찾아서 눌러 주세요.</p>

        {students === null ? (
          <p className="join__lead">불러오는 중…</p>
        ) : students.length === 0 ? (
          <p className="join__lead">아직 명단이 없어요. 선생님께 말씀드려 주세요.</p>
        ) : (
          <ul className="namegrid">
            {students.map((s) => {
              const takenByOther = Boolean(s.claimedBy) && s.claimedBy !== uid
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`namebtn${takenByOther ? ' namebtn--taken' : ''}`}
                    onClick={() => handlePick(s)}
                    disabled={busy || takenByOther}
                  >
                    <span className="namebtn__num">{s.number}</span>
                    <span className="namebtn__name">{s.name}</span>
                    {takenByOther && <span className="namebtn__tag">다른 기기에서 고름</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error && <p className="join__error">{error}</p>}
        <button type="button" className="btn--quiet" onClick={() => { setKlass(null); setStudents(null) }}>
          코드 다시 넣기
        </button>
      </div>
    </main>
  )
}
