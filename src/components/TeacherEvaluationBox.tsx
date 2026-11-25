// 선생님 평가 입력 칸. 발표 하나에 별점과 코멘트 2칸을 남긴다.
// 친구들 평균에는 들어가지 않고, 결과를 공개하면 학생에게 "선생님 평가"로 따로 보인다.
import { useId, useState } from 'react'
import StarRating from './StarRating'
import { saveTeacherEvaluation } from '../lib/activities'
import {
  COMMENT_MAX,
  type ActivityWithId,
  type EvaluationWithId,
  type PresentationWithId,
} from '../lib/types'
import './TeacherEvaluationBox.css'

interface Props {
  activity: ActivityWithId
  presentations: PresentationWithId[]
  presentationId: string
  /** 이미 저장한 선생님 평가. 없으면 undefined. */
  existing: EvaluationWithId | undefined
}

type Message = { ok: boolean; text: string }

export default function TeacherEvaluationBox(props: Props) {
  // 저장 결과 문구는 여기서 들고 있는다. 아래 Box 는 저장된 평가가 도착하면 새로 만들어지기 때문이다.
  const [message, setMessage] = useState<{ presentationId: string; value: Message } | null>(null)
  // 발표가 바뀌거나 저장된 평가가 뒤늦게 도착하면 칸을 새로 채운다.
  return (
    <Box
      key={`${props.presentationId}:${props.existing ? 'saved' : 'new'}`}
      {...props}
      message={message?.presentationId === props.presentationId ? message.value : null}
      setMessage={(value) => setMessage(value && { presentationId: props.presentationId, value })}
    />
  )
}

function Box({
  activity,
  presentations,
  presentationId,
  existing,
  message,
  setMessage,
}: Props & { message: Message | null; setMessage: (m: Message | null) => void }) {
  const id = useId()
  const [scores, setScores] = useState<Record<string, number>>(existing?.scores ?? {})
  const [comment1, setComment1] = useState(existing?.comment1 ?? '')
  const [comment2, setComment2] = useState(existing?.comment2 ?? '')
  const [busy, setBusy] = useState(false)

  const allRated = activity.criteria.every((c) => scores[c.id] !== undefined)

  async function handleSave() {
    if (!allRated) return
    setBusy(true)
    setMessage(null)
    try {
      await saveTeacherEvaluation(activity, presentations, {
        presentationId,
        // 기준에 있는 점수만 보낸다(기준을 고친 뒤 남은 옛 점수를 덜어 낸다)
        scores: Object.fromEntries(activity.criteria.map((c) => [c.id, scores[c.id]])),
        comment1: comment1.trim().slice(0, COMMENT_MAX),
        comment2: comment2.trim().slice(0, COMMENT_MAX),
        isUpdate: Boolean(existing),
      })
      setMessage({
        ok: true,
        text: activity.resultsPublished
          ? '저장했어요. 학생에게 보이는 결과에도 반영했습니다.'
          : '저장했어요. 결과를 공개하면 학생에게 보입니다.',
      })
    } catch {
      setMessage({ ok: false, text: '저장하지 못했어요. 보안 규칙을 새로 올렸는지 확인해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tbox">
      <div className="tbox__stars">
        {activity.criteria.map((c) => (
          <StarRating
            key={c.id}
            label={c.label}
            value={scores[c.id]}
            onChange={(v) => setScores((prev) => ({ ...prev, [c.id]: v }))}
          />
        ))}
      </div>
      <div className="tbox__comments">
        <div>
          <label htmlFor={`${id}-1`}>칭찬 한 가지</label>
          <textarea
            id={`${id}-1`}
            value={comment1}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment1(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-2`}>제안 한 가지</label>
          <textarea
            id={`${id}-2`}
            value={comment2}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment2(e.target.value)}
          />
        </div>
      </div>
      <div className="tbox__foot">
        <button type="button" className="btn--small" onClick={handleSave} disabled={!allRated || busy}>
          {busy ? '저장하는 중…' : existing ? '고쳐서 저장' : '선생님 평가 저장'}
        </button>
        {!allRated && <span className="tbox__hint">별점을 모두 골라야 저장할 수 있어요.</span>}
        {message && (
          <span className={message.ok ? 'tbox__hint' : 'tbox__hint tbox__hint--bad'} role="status">
            {message.text}
          </span>
        )}
      </div>
    </div>
  )
}
