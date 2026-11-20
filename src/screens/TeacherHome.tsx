import { Link, Outlet, useLocation } from 'react-router-dom'
import { signOutTeacher, useAuth } from '../lib/authContext'

export default function TeacherHome() {
  const { teacher } = useAuth()
  const location = useLocation()
  const isRoot = location.pathname === '/teacher'

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="topbar__title">발표 평가</h1>
        {!isRoot && (
          <Link to="/teacher" className="topbar__back">
            학급 목록
          </Link>
        )}
        <span className="topbar__spacer" />
        <span className="topbar__who">{teacher?.displayName ?? '선생님'}</span>
        <button type="button" className="btn--small topbar__out" onClick={signOutTeacher}>
          나가기
        </button>
      </header>
      <div className="content">
        <Outlet />
      </div>
    </div>
  )
}
