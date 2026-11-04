import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer/Footer'
import Navbar from './components/Navbar/Navbar'
import Dashboard from './pages/Dashboard/Dashboard'
import Learning from './pages/Learning/Learning'
import Exercises from './pages/Exercises/Exercises'
import ExerciseWorkspace from './pages/ExerciseWorkspace/ExerciseWorkspace'

function AppContent() {
  const location = useLocation()
  // The workspace has its own status bar footer matching the Figma design
  const isWorkspace = location.pathname.startsWith('/exercises/')

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:id" element={<ExerciseWorkspace />} />
        {/* Fallback: redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isWorkspace && <Footer />}
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
