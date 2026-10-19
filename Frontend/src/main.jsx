import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/layout/global.css'
import './components/layout/Layout.css'
import App from './App.jsx'
import Chart from 'chart.js/auto'
window.Chart = Chart
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)