import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Calibration from './Calibration.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Calibration />
  </StrictMode>,
)
