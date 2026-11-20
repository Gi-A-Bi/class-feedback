import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/authContext'
import { isConfigured } from './lib/firebase'
import SetupCheck from './screens/SetupCheck'
import TeacherLogin from './screens/TeacherLogin'
import TeacherHome from './screens/TeacherHome'
import ClassList from './screens/ClassList'
import ClassDetail from './screens/ClassDetail'

/** 로그인한 교사만 지나갈 수 있는 문 */
function TeacherOnly() {
  const { loading, teacher } = useAuth()
  if (loading) return <p className="spinner">불러오는 중…</p>
  if (!teacher) return <TeacherLogin />
  return <TeacherHome />
}

export default function App() {
  // 설정값이 없으면 어떤 화면도 쓸 수 없으니 1단계 확인 화면을 보여 준다.
  if (!isConfigured) return <SetupCheck />

  return (
    <Routes>
      <Route path="/teacher" element={<TeacherOnly />}>
        <Route index element={<ClassList />} />
        <Route path="class/:classId" element={<ClassDetail />} />
      </Route>
      <Route path="/setup" element={<SetupCheck />} />
      {/* 학생 화면은 3단계에서 /student 로 들어온다. */}
      <Route path="*" element={<Navigate to="/teacher" replace />} />
    </Routes>
  )
}
