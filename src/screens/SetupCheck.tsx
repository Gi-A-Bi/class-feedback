// 개발 1단계 확인 화면: 프로젝트 뼈대와 Firebase 연결이 되는지 눈으로 보는 화면.
// 2단계에서 교사 로그인 화면으로 바뀐다.
import { useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { signInAnonymously, signOut } from 'firebase/auth'
import { getAuthClient, isConfigured, missingConfigKeys, projectId } from '../lib/firebase'
import './SetupCheck.css'

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok' }
  | { kind: 'fail'; message: string }

/**
 * Firebase 오류 코드를 교사가 읽을 수 있는 안내로 바꾼다.
 * 코드 뒤에 설명이 붙어 오는 경우(auth/api-key-not-valid.-please-pass-a-valid-api-key.)가
 * 있으므로 정확히 비교하지 않고 포함 여부로 찾는다.
 */
function explain(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return '연결에 실패했어요. 알 수 없는 오류입니다.'
  }
  const code = error.code
  const has = (part: string) => code.includes(part)

  if (has('configuration-not-found') || has('operation-not-allowed')) {
    return 'Firebase 콘솔에서 익명 로그인이 아직 켜져 있지 않아요. Authentication > Sign-in method(로그인 방법)에서 "Anonymous(익명)"을 켜고 저장해 주세요.'
  }
  if (has('unauthorized-domain')) {
    return '지금 보고 있는 이 주소가 Firebase에 등록되어 있지 않아요. Authentication > Settings(설정) > Authorized domains(승인된 도메인)에 이 주소를 추가해 주세요.'
  }
  if (has('api-key-not-valid') || has('invalid-api-key')) {
    return 'API 키가 맞지 않아요. VITE_FIREBASE_API_KEY 값을 Firebase 콘솔의 값과 다시 맞춰 주세요.'
  }
  if (has('network-request-failed')) {
    return '인터넷으로 Firebase에 닿지 못했어요. 학교 네트워크가 막고 있는지 확인해 주세요.'
  }
  if (has('project-not-found') || has('app-not-authorized')) {
    return '프로젝트를 찾지 못했어요. VITE_FIREBASE_PROJECT_ID와 VITE_FIREBASE_APP_ID 값을 다시 확인해 주세요.'
  }
  return `연결에 실패했어요. 오류 코드: ${code}`
}

function CheckIcon({ ok }: { ok: boolean }) {
  const color = ok ? 'var(--c-primary)' : 'var(--c-error-text)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="none" stroke={color} strokeWidth="1.5" />
      {ok ? (
        <path
          d="M6 10.4l2.6 2.6L14 7.6"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M10 5.8v6M10 14.2v0.1"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export default function SetupCheck() {
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const missing = missingConfigKeys()

  async function runTest() {
    setTest({ kind: 'running' })
    try {
      const auth = getAuthClient()
      await signInAnonymously(auth)
      // 확인만 하는 화면이므로 바로 로그아웃해 둔다.
      await signOut(auth)
      setTest({ kind: 'ok' })
    } catch (error) {
      setTest({ kind: 'fail', message: explain(error) })
    }
  }

  return (
    <main className="setup">
      <div className="setup__card">
        <h1 className="setup__title">발표 평가 프로그램</h1>
        <p className="setup__lead">
          1단계 확인 화면입니다. 아래가 모두 초록색이면 다음 단계로 넘어갈 수 있어요.
        </p>

        <ul className="setup__list">
          <li className="setup__row">
            <CheckIcon ok />
            <span>
              <span className="setup__label">화면이 떴어요</span>
              <span className="setup__detail">
                주소가 열리고 React 화면이 그려졌습니다.
              </span>
            </span>
          </li>
          <li className="setup__row">
            <CheckIcon ok={isConfigured} />
            <span>
              <span className="setup__label">
                {isConfigured ? 'Firebase 설정값이 들어왔어요' : 'Firebase 설정값이 비어 있어요'}
              </span>
              <span className="setup__detail">
                {isConfigured ? (
                  <>
                    프로젝트: <code>{projectId}</code>
                  </>
                ) : (
                  <>아직 채워지지 않은 값: {missing.map((k) => <code key={k}>{k} </code>)}</>
                )}
              </span>
            </span>
          </li>
          <li className="setup__row">
            <CheckIcon ok={test.kind === 'ok'} />
            <span>
              <span className="setup__label">
                {test.kind === 'ok' ? 'Firebase에 연결됐어요' : 'Firebase 연결은 아직 확인 전이에요'}
              </span>
              <span className="setup__detail">
                아래 버튼을 누르면 익명 로그인으로 실제 연결을 시험해 봅니다.
              </span>
            </span>
          </li>
        </ul>

        {!isConfigured && (
          <div className="setup__note">
            <p>
              <strong>설정값을 넣는 곳</strong>
            </p>
            <ol>
              <li>
                내 컴퓨터에서 볼 때는 프로젝트 폴더에 <code>.env</code> 파일을 만들고{' '}
                <code>.env.example</code>의 내용을 복사해 값을 채웁니다.
              </li>
              <li>
                인터넷 주소(Vercel)로 볼 때는 Vercel 프로젝트의 Settings &gt; Environment Variables
                에 같은 값을 넣고 다시 배포합니다.
              </li>
            </ol>
          </div>
        )}

        <div className="setup__actions">
          <button type="button" onClick={runTest} disabled={!isConfigured || test.kind === 'running'}>
            {test.kind === 'running' ? '확인하는 중…' : 'Firebase 연결 시험하기'}
          </button>
          {test.kind === 'ok' && (
            <p className="setup__result">연결에 성공했어요. 1단계가 끝났습니다.</p>
          )}
          {test.kind === 'fail' && (
            <p className="setup__result setup__result--bad">{test.message}</p>
          )}
        </div>

        <p className="setup__foot">
          학생 태블릿(가로 1024×768)에서도 이 화면이 스크롤 없이 보이는지 확인해 주세요.
        </p>
      </div>
    </main>
  )
}
