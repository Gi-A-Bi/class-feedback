import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SetupCheck from './screens/SetupCheck'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root 를 찾을 수 없습니다.')

createRoot(rootElement).render(
  <StrictMode>
    <SetupCheck />
  </StrictMode>,
)
