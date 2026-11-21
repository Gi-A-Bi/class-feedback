import { useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { signInTeacher } from '../lib/authContext'

function explainSignIn(error: unknown): string {
  if (error instanceof FirebaseError) {
    const code = error.code
    if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
      return '로그인 창이 닫혔어요. 다시 눌러 주세요.'
    }
    if (code.includes('popup-blocked')) {
      return '브라우저가 로그인 창을 막았어요. 주소창 오른쪽의 차단 표시를 눌러 허용해 주세요.'
    }
    if (code.includes('unauthorized-domain')) {
      return '이 주소가 Firebase에 등록되어 있지 않아요. Authentication > 설정 > 승인된 도메인을 확인해 주세요.'
    }
    if (code.includes('operation-not-allowed')) {
      return 'Google 로그인이 켜져 있지 않아요. Authentication > 로그인 방법에서 Google을 켜 주세요.'
    }
    if (code.includes('network-request-failed')) {
      return '인터넷 연결을 확인해 주세요.'
    }
    return `로그인에 실패했어요. 오류 코드: ${code}`
  }
  return '로그인에 실패했어요.'
}

export default function TeacherLogin() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signInTeacher()
    } catch (e) {
      setError(explainSignIn(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="content" style={{ maxWidth: 480, marginTop: '12vh' }}>
        <div className="card">
          <h1 className="card__title">발표 평가</h1>
          <p className="card__hint">선생님용 화면입니다. 구글 계정으로 들어오세요.</p>
          <button type="button" onClick={handleSignIn} disabled={busy}>
            {busy ? '들어가는 중…' : 'Google 계정으로 로그인'}
          </button>
          {error && <p className="msg msg--bad">{error}</p>}
          <p className="card__hint" style={{ marginTop: 16, marginBottom: 0 }}>
            <a href="/privacy.html" style={{ color: 'inherit' }}>
              개인정보처리방침
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
