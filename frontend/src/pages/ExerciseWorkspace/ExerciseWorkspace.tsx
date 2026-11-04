import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { EXERCISES, TEST_CASES, type Exercise } from '../../data/exercises'
import ProblemDescription from './components/ProblemDescription/ProblemDescription'
import ProgressiveHints from './components/ProgressiveHints/ProgressiveHints'
import WorkspaceCodeEditor from './components/WorkspaceCodeEditor/WorkspaceCodeEditor'
import ExecutionPanel from './components/ExecutionPanel/ExecutionPanel'
import AITutorPanel from './components/AITutorPanel/AITutorPanel'
import './ExerciseWorkspace.css'

export default function ExerciseWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Find current exercise by id or fallback to default
  const exercise: Exercise = useMemo(() => {
    const found = EXERCISES.find((e) => e.id === id)
    return found || EXERCISES[0]
  }, [id])

  const currentIndex = EXERCISES.findIndex((e) => e.id === exercise.id)
  const prevExercise = currentIndex > 0 ? EXERCISES[currentIndex - 1] : null
  const nextExercise =
    currentIndex < EXERCISES.length - 1 ? EXERCISES[currentIndex + 1] : null

  // State
  const [leftTab, setLeftTab] = useState<'description' | 'hints' | 'submissions'>('description')
  const [code, setCode] = useState<string>(exercise.initialCode)
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAITutorOpen, setIsAITutorOpen] = useState(false)
  const [nudgeAccordionOpen, setNudgeAccordionOpen] = useState(false)

  // Test cases for this exercise
  const testCases = TEST_CASES[exercise.id] || TEST_CASES['sum-of-even-numbers']

  // Execution result state
  const [runResult, setRunResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'error'
    message?: string
    results?: {
      caseId: string
      passed: boolean
      actualOutput: string
    }[]
  }>({
    status: 'idle',
  })

  // Simulated submissions history
  const [submissions, setSubmissions] = useState<
    {
      id: string
      time: string
      status: 'Accepted' | 'Wrong Answer'
      runtime: string
      memory: string
    }[]
  >([])

  // Reset code handler
  const handleResetCode = () => {
    if (window.confirm('Reset code to the original starter template?')) {
      setCode(exercise.initialCode)
    }
  }

  // Simulate Run code
  const handleRun = () => {
    setIsRunning(true)
    setRunResult({ status: 'running' })

    setTimeout(() => {
      setIsRunning(false)
      // Check if user has written an actual solution or still has default pass
      const isStillPass = code.includes('pass') && !code.includes('+=') && !code.includes('sum(')

      if (isStillPass) {
        setRunResult({
          status: 'error',
          message:
            'Test case 1 failed: Expected 12, but function returned None (pass statement executed).',
          results: testCases.map((tc, idx) => ({
            caseId: tc.id,
            passed: idx === 99, // fail
            actualOutput: 'None',
          })),
        })
      } else {
        setRunResult({
          status: 'success',
          message: 'All test cases executed successfully without errors.',
          results: testCases.map((tc) => ({
            caseId: tc.id,
            passed: true,
            actualOutput: tc.expectedOutput,
          })),
        })
      }
    }, 700)
  }

  // Simulate Submit code
  const handleSubmit = () => {
    setIsSubmitting(true)

    setTimeout(() => {
      setIsSubmitting(false)
      const isStillPass = code.includes('pass') && !code.includes('+=') && !code.includes('sum(')

      if (isStillPass) {
        setRunResult({
          status: 'error',
          message: 'Submission failed: 0/3 test cases passed. Output was None.',
          results: testCases.map((tc) => ({
            caseId: tc.id,
            passed: false,
            actualOutput: 'None',
          })),
        })
        setSubmissions((prev) => [
          {
            id: String(Date.now()),
            time: 'Just now',
            status: 'Wrong Answer',
            runtime: '32 ms',
            memory: '14.1 MB',
          },
          ...prev,
        ])
      } else {
        setRunResult({
          status: 'success',
          message: 'Accepted! All 3/3 test cases passed. Fantastic job!',
          results: testCases.map((tc) => ({
            caseId: tc.id,
            passed: true,
            actualOutput: tc.expectedOutput,
          })),
        })
        setSubmissions((prev) => [
          {
            id: String(Date.now()),
            time: 'Just now',
            status: 'Accepted',
            runtime: '21 ms',
            memory: '14.2 MB',
          },
          ...prev,
        ])
      }
    }, 1000)
  }

  return (
    <div className="workspace">
      {/* 1. Workspace Subheader / Breadcrumbs & Navigation Bar */}
      <nav className="workspace__breadcrumb-bar" aria-label="Exercise navigation">
        <div className="workspace__breadcrumbs">
          <Link to="/exercises" className="workspace__back-link">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>All exercises</span>
          </Link>
          <span className="workspace__breadcrumb-slash">/</span>
          <span className="workspace__course-name">{exercise.courseTitle}</span>
        </div>

        <div className="workspace__pagination">
          <span className="workspace__exercise-count">
            Exercise {String(exercise.number).padStart(2, '0')} of {exercise.total}
          </span>
          <div className="workspace__nav-btns">
            <button
              type="button"
              className="workspace__nav-btn"
              disabled={!prevExercise}
              onClick={() => prevExercise && navigate(`/exercises/${prevExercise.id}`)}
              aria-label="Previous exercise"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="workspace__nav-btn"
              disabled={!nextExercise}
              onClick={() => nextExercise && navigate(`/exercises/${nextExercise.id}`)}
              aria-label="Next exercise"
            >
              <span>Next exercise</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Main Two-Column Workspace Content */}
      <main className="workspace__main">
        {/* Left Column: Problem Card (Description | Hints | Submissions) */}
        <section className="workspace__left-panel" aria-label="Problem information">
          <div className="workspace__panel-card">
            {/* Top Tabs */}
            <div className="workspace__left-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={leftTab === 'description'}
                className={`workspace__left-tab ${
                  leftTab === 'description' ? 'workspace__left-tab--active' : ''
                }`}
                onClick={() => setLeftTab('description')}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Description</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={leftTab === 'hints'}
                className={`workspace__left-tab ${
                  leftTab === 'hints' ? 'workspace__left-tab--active' : ''
                }`}
                onClick={() => setLeftTab('hints')}
              >
                <span>Hints</span>
                <span className="workspace__hints-count">{exercise.hints.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={leftTab === 'submissions'}
                className={`workspace__left-tab ${
                  leftTab === 'submissions' ? 'workspace__left-tab--active' : ''
                }`}
                onClick={() => setLeftTab('submissions')}
              >
                <span>Submissions</span>
                {submissions.length > 0 && (
                  <span className="workspace__submissions-count">{submissions.length}</span>
                )}
              </button>
            </div>

            {/* Left Content Area */}
            <div className="workspace__left-content">
              {leftTab === 'description' && (
                <>
                  <ProblemDescription exercise={exercise} />

                  {/* Nudge Accordion at bottom matching Figma design */}
                  <div className="workspace__nudge-section">
                    <button
                      type="button"
                      className="workspace__nudge-toggle"
                      onClick={() => setNudgeAccordionOpen((v) => !v)}
                      aria-expanded={nudgeAccordionOpen}
                    >
                      <div className="workspace__nudge-left">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          width="16"
                          height="16"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        <span>Need a nudge? Show a hint</span>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        width="14"
                        height="14"
                        className={`workspace__nudge-chevron ${
                          nudgeAccordionOpen ? 'workspace__nudge-chevron--open' : ''
                        }`}
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {nudgeAccordionOpen && (
                      <div className="workspace__nudge-dropdown">
                        <ProgressiveHints hints={exercise.hints} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {leftTab === 'hints' && <ProgressiveHints hints={exercise.hints} />}

              {leftTab === 'submissions' && (
                <div className="workspace__submissions-panel">
                  <h2 className="workspace__submissions-title">Submission History</h2>
                  {submissions.length === 0 ? (
                    <div className="workspace__submissions-empty">
                      <p>No submissions yet.</p>
                      <p className="workspace__submissions-subtitle">
                        Click the blue <strong>Submit</strong> button on the bottom right to test
                        and record your solution.
                      </p>
                    </div>
                  ) : (
                    <div className="workspace__submissions-list">
                      {submissions.map((sub) => (
                        <div key={sub.id} className="workspace__submission-item">
                          <div className="workspace__submission-header">
                            <span
                              className={`workspace__submission-badge ${
                                sub.status === 'Accepted'
                                  ? 'workspace__submission-badge--accepted'
                                  : 'workspace__submission-badge--wrong'
                              }`}
                            >
                              {sub.status === 'Accepted' ? '✓ Accepted' : '✗ Wrong Answer'}
                            </span>
                            <span className="workspace__submission-time">{sub.time}</span>
                          </div>
                          <div className="workspace__submission-meta">
                            <span>Runtime: {sub.runtime}</span>
                            <span>Memory: {sub.memory}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Code Editor + Execution Console Panel */}
        <section className="workspace__right-panel" aria-label="Code and Execution">
          {/* Top: Code Editor */}
          <div className="workspace__editor-slot">
            <WorkspaceCodeEditor
              value={code}
              onChange={setCode}
              filename={exercise.filename}
              onReset={handleResetCode}
            />
          </div>

          {/* Bottom: Console & Test Cases Panel */}
          <div className="workspace__console-slot">
            <ExecutionPanel
              testCases={testCases}
              onRun={handleRun}
              onSubmit={handleSubmit}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              runResult={runResult}
            />
          </div>
        </section>
      </main>

      {/* 3. Workspace Bottom Status Bar matching Figma */}
      <footer className="workspace__footer" role="contentinfo">
        <div className="workspace__footer-left">
          <span>A little practice. A lot of possibility.</span>
        </div>
        <div className="workspace__footer-right">
          <span>Python 3.12</span>
          <span className="workspace__footer-dot">·</span>
          <span>Ready when you are</span>
        </div>
      </footer>

      {/* 4. Collapsible AI Tutor Panel */}
      <AITutorPanel
        exercise={exercise}
        currentCode={code}
        isOpen={isAITutorOpen}
        onToggle={() => setIsAITutorOpen((v) => !v)}
      />
    </div>
  )
}

