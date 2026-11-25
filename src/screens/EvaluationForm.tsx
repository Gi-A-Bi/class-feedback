// 평가 입력 칸. 발표자가 바뀌면 부모가 key 를 바꿔서 이 컴포넌트를 새로 만들고,
// 그래서 별점과 코멘트가 저절로 비워진다.
import { useEffect, useState } from 'react'
import StarRating from '../components/StarRating'
import { getMyEvaluation, submitEvaluation } from '../lib/activities'
import { COMMENT_MAX, type Criterion } from '../lib/types'

interface Props {
  activityId: string
  presentationId: string
  studentId: string
  criteria: Criterion[]
  isSelf: boolean
  hasNext: boolean
  /** 지난 발표의 평가를 고치는 중이면 true. 안내 문구가 달라진다. */
  past?: boolean
  /** 내는 데 성공하면 부른다. */
  onSaved?: () => void
}

export default function EvaluationForm({
  activityId,
  presentationId,
  studentId,
  criteria,
  isSelf,
  hasNext,
  past = false,
  onSaved,
}: Props) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment1, setComment1] = useState('')
  const [comment2, setComment2] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hadSubmitted, setHadSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 이미 낸 평가가 있는지 확인이 끝났는가. 끝나기 전에 쓰기 시작하면 되살린 내용이 덮어쓴다.
  const [loaded, setLoaded] = useState(false)

  // 이미 낸 평가가 있으면 되살린다(화면을 새로 고쳤을 때, 지난 평가를 고칠 때).
  useEffect(() => {
    let alive = true
    getMyEvaluation(activityId, presentationId, studentId)
      .then((mine) => {
        if (!alive || !mine) return
        setScores(mine.scores)
        setComment1(mine.comment1)
        setComment2(mine.comment2)
        // 지난 평가를 고치러 왔으면 바로 고칠 수 있게 입력 칸을 보여 준다
        setSubmitted(!past)
        setHadSubmitted(true)
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [activityId, presentationId, studentId, past])

  const allRated = criteria.length > 0 && criteria.every((c) => scores[c.id] !== undefined)

  async function handleSubmit() {
    if (!allRated) return
    setBusy(true)
    setError(null)
    try {
      await submitEvaluation({
        activityId,
        presentationId,
        studentId,
        kind: isSelf ? 'self' : 'peer',
        scores,
        comment1: comment1.trim().slice(0, COMMENT_MAX),
        comment2: comment2.trim().slice(0, COMMENT_MAX),
        isUpdate: hadSubmitted,
      })
      setHadSubmitted(true)
      setSubmitted(true)
      onSaved?.()
    } catch {
      setError('내지 못했어요. 선생님이 활동을 끝냈을 수도 있어요.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="eval__done">
        <p className="eval__doneText">불러오고 있어요…</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="eval__done">
        <h2 className="eval__doneTitle">{past ? '고친 대로 냈어요!' : '다 냈어요!'}</h2>
        <p className="eval__doneText">
          {past
            ? '왼쪽에서 다른 발표를 골라 고치거나, 위의 "지금 발표로"를 눌러 돌아가요.'
            : hasNext
              ? '다음 발표를 기다려 주세요. 발표자가 바뀌면 화면이 저절로 넘어가요. 지난 평가는 위의 "지난 평가"에서 고칠 수 있어요.'
              : '마지막 발표였어요. 수고했어요. 지난 평가는 선생님이 활동을 끝내기 전까지 고칠 수 있어요.'}
        </p>
        <ul className="eval__summary">
          {criteria.map((c) => (
            <li key={c.id}>
              <span>{c.label}</span>
              <strong>{scores[c.id]}점</strong>
            </li>
          ))}
        </ul>
        <button type="button" className="btn--ghost" onClick={() => setSubmitted(false)}>
          다시 고치기
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="eval__stars">
        {criteria.map((c) => (
          <StarRating
            key={c.id}
            label={c.label}
            value={scores[c.id]}
            tone={isSelf ? 'self' : 'normal'}
            onChange={(v) => setScores((prev) => ({ ...prev, [c.id]: v }))}
          />
        ))}
      </div>

      <div className="eval__comments">
        <div>
          <label htmlFor="c1">{isSelf ? '잘한 점' : '칭찬 한 가지'}</label>
          <textarea
            id="c1"
            value={comment1}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment1(e.target.value)}
            placeholder={isSelf ? '내가 잘한 점을 써 봐요' : '좋았던 점을 써 봐요'}
          />
        </div>
        <div>
          <label htmlFor="c2">{isSelf ? '다음에 고칠 점' : '제안 한 가지'}</label>
          <textarea
            id="c2"
            value={comment2}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment2(e.target.value)}
            placeholder={isSelf ? '다음에 더 잘하고 싶은 점을 써 봐요' : '이렇게 하면 더 좋겠다는 점을 써 봐요'}
          />
        </div>
      </div>

      <div className="eval__foot">
        <button type="button" onClick={handleSubmit} disabled={!allRated || busy}>
          {busy ? '내는 중…' : hadSubmitted ? '고쳐서 다시 내기' : '다 했어요'}
        </button>
        {!allRated && <span className="eval__hint">별점을 모두 골라야 낼 수 있어요.</span>}
        {error && <span className="eval__err">{error}</span>}
      </div>
    </>
  )
}
