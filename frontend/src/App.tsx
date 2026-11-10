import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer/Footer'
import Navbar from './components/Navbar/Navbar'
import Dashboard from './pages/Dashboard/Dashboard'
import Learning from './pages/Learning/Learning'
import Exercises from './pages/Exercises/Exercises'
import ExerciseWorkspace from './pages/ExerciseWorkspace/ExerciseWorkspace'
import LessonDetail from './pages/LessonDetail/LessonDetail'

function AppContent() {
  const location = useLocation()
  // The workspace and lesson detail pages have their own integrated layout / status footers
  const isWorkspace = location.pathname.startsWith('/exercises/')
  const isLesson = location.pathname.startsWith('/lessons')

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/lessons/:id" element={<LessonDetail />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:id" element={<ExerciseWorkspace />} />
        {/* Fallback: redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isWorkspace && !isLesson && <Footer />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
