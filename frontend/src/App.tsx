import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Footer from './components/Footer/Footer'
import Navbar from './components/Navbar/Navbar'
import Dashboard from './pages/Dashboard/Dashboard'
import Learning from './pages/Learning/Learning'
import Exercises from './pages/Exercises/Exercises'
import ExerciseWorkspace from './pages/ExerciseWorkspace/ExerciseWorkspace'
import LessonDetail from './pages/LessonDetail/LessonDetail'
import AuthPage from './pages/AuthPage/AuthPage'

function AppContent() {
  const location = useLocation()
  // The workspace and lesson detail pages have their own integrated layout / status footers
  const isWorkspace = location.pathname.startsWith('/exercises/')
  const isLesson = location.pathname.startsWith('/lessons')

  return (
    <>
      {!location.pathname.startsWith('/login') && !location.pathname.startsWith('/register') && <Navbar />}
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/lessons/:id" element={<LessonDetail />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:id" element={<ExerciseWorkspace />} />
        {/* Fallback: redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isWorkspace && !isLesson && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/register') && <Footer />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
