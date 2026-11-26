import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/authContext'
import { isConfigured } from './lib/firebase'
import SetupCheck from './screens/SetupCheck'
import TeacherLogin from './screens/TeacherLogin'
import TeacherHome from './screens/TeacherHome'
import ClassList from './screens/ClassList'
import ClassDetail from './screens/ClassDetail'
import ClassRecords from './screens/ClassRecords'
import ActivityNew from './screens/ActivityNew'
import ActivityRun from './screens/ActivityRun'
import ActivityResults from './screens/ActivityResults'
import StudentApp from './screens/StudentApp'
import PortfolioConnect from './screens/PortfolioConnect'

/** 로그인한 교사만 지나갈 수 있는 문 */
function TeacherGuard() {
  const { loading, teacher } = useAuth()
  if (loading) return <p className="spinner">불러오는 중…</p>
  if (!teacher) return <TeacherLogin />
  return <Outlet />
}

export default function App() {
  // 설정값이 없으면 어떤 화면도 쓸 수 없으니 1단계 확인 화면을 보여 준다.
  if (!isConfigured) return <SetupCheck />

  return (
    <Routes>
      <Route element={<TeacherGuard />}>
        {/* 학급 관리: 공통 머리띠 + 가운데 정렬된 본문 */}
        <Route path="/teacher" element={<TeacherHome />}>
          <Route index element={<ClassList />} />
          <Route path="class/:classId" element={<ClassDetail />} />
          <Route path="class/:classId/new-activity" element={<ActivityNew />} />
          <Route path="class/:classId/records" element={<ClassRecords />} />
        </Route>
        {/* 진행 화면은 수업 중에 띄워 두는 화면이라 머리띠를 따로 쓴다 */}
        <Route path="/teacher/activity/:activityId" element={<ActivityRun />} />
        <Route path="/teacher/activity/:activityId/results" element={<ActivityResults />} />
      </Route>
      <Route path="/portfolio-connect" element={<PortfolioConnect />} />
      <Route path="/student" element={<StudentApp />} />
      <Route path="/setup" element={<SetupCheck />} />
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  )
}

