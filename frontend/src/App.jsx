import { Route, Routes } from 'react-router-dom'
import PatternListPage from './pages/PatternListPage.jsx'
import PatternEditorPage from './pages/PatternEditorPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PatternListPage />} />
      <Route path="/patterns/:id" element={<PatternEditorPage />} />
    </Routes>
  )
}

export default App
