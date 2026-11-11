import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { EXERCISES, TEST_CASES, type Exercise, type TestCase } from '../../data/exercises'
<<<<<<< HEAD
import { fetchExercise, fetchExercises, saveProgress, type ApiExercise } from '../../lib/api'
=======
import { fetchExercise, saveProgress, submitExercise, type ApiExercise, type SubmitResult } from '../../lib/api'
>>>>>>> e031c30 (feat(runner): implement code execution runner with test cases and workspace integration)
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { usePyodide, type PyodideResult } from '../../hooks/usePyodide'
import ProblemDescription from './components/ProblemDescription/ProblemDescription'
import ProgressiveHints from './components/ProgressiveHints/ProgressiveHints'
import WorkspaceCodeEditor from './components/WorkspaceCodeEditor/WorkspaceCodeEditor'
import ExecutionPanel from './components/ExecutionPanel/ExecutionPanel'
import AITutorPanel from './components/AITutorPanel/AITutorPanel'
import './ExerciseWorkspace.css'

export default function ExerciseWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoading: pyodideLoading, loadError: pyodideError, runTestCase, isReady } = usePyodide()
  const [apiExercise, setApiExercise] = useState<ApiExercise | null>(null)
  const [apiExercises, setApiExercises] = useState<ApiExercise[]>([])

  useEffect(() => {
    if (!id) return
    let active = true
    Promise.all([fetchExercise(id), fetchExercises()]).then(([record, records]) => {
      if (active) {
        setApiExercise(record)
        setApiExercises(records)
      }
    }).catch(() => {
      if (active) setApiExercise(null)
    })
    return () => { active = false }
  }, [id])

  // Find current exercise by id or fallback to default
  const fallbackExercise = useMemo(() => {
    if (apiExercise) {
      return EXERCISES.find((item) => item.filename === apiExercise.test_cases.filename) ?? EXERCISES[0]
    }
    return EXERCISES.find((item) => String(item.id) === id) ?? EXERCISES[0]
  }, [id, apiExercise])

  const exercise: Exercise = useMemo(() => {
    const fallback = fallbackExercise
    if (!apiExercise) return fallback
    return {
      ...fallback,
      id: apiExercise.id,
      title: apiExercise.title,
      difficulty: apiExercise.difficulty,
      tags: apiExercise.tags,
      description: sanitizeHtml(apiExercise.description),
      functionName: apiExercise.function_name,
      functionSignature: apiExercise.test_cases.functionSignature ?? fallback.functionSignature,
      examples: apiExercise.test_cases.examples ?? fallback.examples,
      constraints: apiExercise.test_cases.constraints ?? fallback.constraints,
      hints: apiExercise.hints ?? fallback.hints,
      initialCode: apiExercise.starter_code,
      number: apiExercise.test_cases.number ?? fallback.number,
      total: apiExercise.test_cases.total ?? fallback.total,
      filename: apiExercise.test_cases.filename ?? fallback.filename,
      courseId: apiExercise.test_cases.courseId ?? fallback.courseId,
      courseTitle: apiExercise.test_cases.courseTitle ?? fallback.courseTitle,
      relatedLesson: fallback.relatedLesson
        ? { ...fallback.relatedLesson, to: `/lessons/${apiExercise.lesson_id}` }
        : undefined,
    }
  }, [fallbackExercise, apiExercise])

  const orderedApiExercises = apiExercises.slice().sort((left, right) => left.test_cases.number - right.test_cases.number)
  const currentApiIndex = apiExercise ? orderedApiExercises.findIndex((item) => item.id === apiExercise.id) : -1
  const currentStaticIndex = EXERCISES.findIndex((item) => String(item.id) === String(exercise.id))
  const prevExercise = apiExercise
    ? currentApiIndex > 0 ? orderedApiExercises[currentApiIndex - 1] : null
    : currentStaticIndex > 0 ? EXERCISES[currentStaticIndex - 1] : null
  const nextExercise = apiExercise
    ? currentApiIndex >= 0 && currentApiIndex < orderedApiExercises.length - 1 ? orderedApiExercises[currentApiIndex + 1] : null
    : currentStaticIndex >= 0 && currentStaticIndex < EXERCISES.length - 1 ? EXERCISES[currentStaticIndex + 1] : null

  // State
  const [leftTab, setLeftTab] = useState<'description' | 'hints' | 'submissions'>('description')
  const [code, setCode] = useState<string>(exercise.initialCode)
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAITutorOpen, setIsAITutorOpen] = useState(false)
  const [nudgeAccordionOpen, setNudgeAccordionOpen] = useState(false)

  // Keep code and run state in sync when switching exercises
  useEffect(() => {
    setCode(exercise.initialCode)
    setRunResult({ status: 'idle' })
  }, [exercise.id, exercise.initialCode])

  // Test cases for this exercise
  const testCases: TestCase[] = apiExercise?.test_cases.runner ?? TEST_CASES[String(fallbackExercise.id)] ?? TEST_CASES['sum-of-even-numbers']

  // Execution result state
  const [runResult, setRunResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'error'
    message?: string
    stdout?: string
    results?: {
      caseId: string
      passed: boolean
      actualOutput: string
      error?: string
      executionTime?: number
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

  /**
   * Normalize a Python repr value for comparison.
   * Handles quoting differences: Python uses single quotes by default for strings,
   * but our expected output might use double quotes.
   */
  function normalizeForComparison(value: string): string {
    let v = value.trim()
    // Python's repr returns 'None' for None
    if (v === 'None') return 'None'
    // Normalize string quoting: remove outer quotes and compare the inner content
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      return v.slice(1, -1)
    }
    return v
  }

  /**
   * Run a single test case through Pyodide and return the result.
   */
  async function executeTestCase(tc: TestCase): Promise<{
    caseId: string
    passed: boolean
    actualOutput: string
    error?: string
    executionTime?: number
  }> {
    try {
      const result: PyodideResult = await runTestCase(
        code,
        exercise.functionName,
        tc.argsExpression
      )

      if (!result.success) {
        return {
          caseId: tc.id,
          passed: false,
          actualOutput: result.error || 'Runtime error',
          error: result.error,
          executionTime: result.executionTime,
        }
      }

      const actualValue = result.returnValue ?? 'None'
      const normalizedActual = normalizeForComparison(actualValue)
      const normalizedExpected = normalizeForComparison(tc.expectedOutput)
      const passed = normalizedActual === normalizedExpected

      return {
        caseId: tc.id,
        passed,
        actualOutput: actualValue,
        executionTime: result.executionTime,
      }
    } catch (err: any) {
      return {
        caseId: tc.id,
        passed: false,
        actualOutput: err?.message || 'Unknown error',
        error: err?.message || 'Unknown error',
        executionTime: 0,
      }
    }
  }

  // Run code — execute all test cases with real Python
  const handleRun = async () => {
    if (!isReady) return

    setIsRunning(true)
    setRunResult({ status: 'running' })

    const startTime = performance.now()
    const results = []

    for (const tc of testCases) {
      const result = await executeTestCase(tc)
      results.push(result)
    }

    const totalTime = Math.round(performance.now() - startTime)
    const allPassed = results.every((r) => r.passed)
    const passedCount = results.filter((r) => r.passed).length
    const totalCount = results.length

    const firstError = results.find((r) => !r.passed)

    setRunResult({
      status: allPassed ? 'success' : 'error',
      message: allPassed
        ? `All test cases executed successfully. (${totalTime}ms)`
        : `Test failed: ${passedCount}/${totalCount} passed.${
            firstError?.error ? `\n${firstError.error}` : ''
          }`,
      stdout: results.map((r) => {
        const tc = testCases.find((t) => t.id === r.caseId)
        return `${tc?.label}: ${r.passed ? '✓ PASS' : '✗ FAIL'} → ${r.actualOutput} (${r.executionTime}ms)`
      }).join('\n'),
      results,
    })

    setIsRunning(false)
  }

  // Submit code — send to backend judge (or fallback to Pyodide if backend offline)
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setRunResult({ status: 'running', message: 'Submitting solution to backend judge...' })

    try {
      const result: SubmitResult = await submitExercise(exercise.id, code)

      const isAccepted = result.status === 'Accepted'
      const statusText = isAccepted ? 'success' : 'error'

      let details = `Status: ${result.status}\nPassed: ${result.passed_count}/${result.total_count} test cases (including hidden cases)\nRuntime: ${result.runtime_ms} ms`

      if (result.failed_case) {
        if (result.failed_case.is_hidden) {
          details += `\nFailed on: Hidden Test Case (Corner Case)`
        } else {
          details += `\nFailed on: ${result.failed_case.label || result.failed_case.case_id}`
          if (result.failed_case.expected !== undefined) {
            details += `\nExpected: ${result.failed_case.expected}\nActual: ${result.failed_case.actual}`
          }
        }
        if (result.failed_case.error) {
          details += `\nError: ${result.failed_case.error}`
        }
      }

      if (result.error && !result.failed_case?.error) {
        details += `\nError: ${result.error}`
      }

      setRunResult({
        status: statusText,
        message: isAccepted
          ? `🎉 Accepted! All ${result.total_count}/${result.total_count} test cases passed. Fantastic job!`
          : `Submission result: ${result.status} (${result.passed_count}/${result.total_count} passed).`,
        stdout: details,
      })

      setSubmissions((prev) => [
        {
          id: String(Date.now()),
          time: 'Just now',
          status: isAccepted ? 'Accepted' : 'Wrong Answer',
          runtime: `${result.runtime_ms} ms`,
          memory: 'Server Sandbox',
        },
        ...prev,
      ])
    } catch (err: any) {
      console.warn('Backend submission unavailable, falling back to browser evaluation...', err)

      if (!isReady) {
        setRunResult({
          status: 'error',
          message: 'Backend server is not running and Python runtime is still loading. Please start backend or wait for Pyodide.',
        })
        setIsSubmitting(false)
        return
      }

      const startTime = performance.now()
      const results = []

      for (const tc of testCases) {
        const r = await executeTestCase(tc)
        results.push(r)
      }

      const totalTime = Math.round(performance.now() - startTime)
      const allPassed = results.every((r) => r.passed)
      const passedCount = results.filter((r) => r.passed).length
      const totalCount = results.length

      setRunResult({
        status: allPassed ? 'success' : 'error',
        message: allPassed
          ? `Accepted! (Browser-evaluated) All ${totalCount}/${totalCount} test cases passed.`
          : `Submission failed: ${passedCount}/${totalCount} test cases passed.`,
        stdout: results
          .map((r) => {
            const tc = testCases.find((t) => t.id === r.caseId)
            return `${tc?.label}: ${r.passed ? '✓ PASS' : '✗ FAIL'} → ${r.actualOutput} (${r.executionTime}ms)`
          })
          .join('\n'),
        results,
      })

      if (allPassed) void saveProgress(exercise.id, 'exercise', 'completed').catch(() => undefined)

      setSubmissions((prev) => [
        {
          id: String(Date.now()),
          time: 'Just now',
          status: allPassed ? 'Accepted' : 'Wrong Answer',
          runtime: `${totalTime} ms`,
          memory: '~14 MB (Browser)',
        },
        ...prev,
      ])
    } finally {
      setIsSubmitting(false)
    }
<<<<<<< HEAD

    const totalTime = Math.round(performance.now() - startTime)
    const allPassed = results.every((r) => r.passed)
    const passedCount = results.filter((r) => r.passed).length
    const totalCount = results.length

    setRunResult({
      status: allPassed ? 'success' : 'error',
      message: allPassed
        ? `Accepted! All ${totalCount}/${totalCount} test cases passed. Fantastic job! (${totalTime}ms)`
        : `Submission failed: ${passedCount}/${totalCount} test cases passed.`,
      stdout: results.map((r) => {
        const tc = testCases.find((t) => t.id === r.caseId)
        return `${tc?.label}: ${r.passed ? '✓ PASS' : '✗ FAIL'} → ${r.actualOutput} (${r.executionTime}ms)`
      }).join('\n'),
      results,
    })

    // This is learner-reported browser execution progress, not server-side grading.
    if (allPassed && typeof exercise.id === 'number') {
      void saveProgress(exercise.id, 'exercise', 'completed').catch(() => undefined)
    }

    setSubmissions((prev) => [
      {
        id: String(Date.now()),
        time: 'Just now',
        status: allPassed ? 'Accepted' : 'Wrong Answer',
        runtime: `${totalTime} ms`,
        memory: '~14 MB',
      },
      ...prev,
    ])

    setIsSubmitting(false)
=======
>>>>>>> e031c30 (feat(runner): implement code execution runner with test cases and workspace integration)
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

      {/* Pyodide loading banner */}
      {pyodideLoading && (
        <div className="workspace__pyodide-banner">
          <span className="workspace__pyodide-spinner" />
          <span>Loading Python runtime (Pyodide)… This may take a few seconds on first visit.</span>
        </div>
      )}

      {pyodideError && (
        <div className="workspace__pyodide-error">
          <span>⚠ Failed to load Python runtime: {pyodideError}</span>
        </div>
      )}

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
              pyodideReady={isReady}
              pyodideLoading={pyodideLoading}
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
          <span className={`workspace__pyodide-status ${isReady ? 'workspace__pyodide-status--ready' : ''}`}>
            {isReady ? '● Pyodide Ready' : pyodideLoading ? '○ Loading…' : '○ Offline'}
          </span>
          <span className="workspace__footer-dot">·</span>
          <span>Python 3.12 (WebAssembly)</span>
          <span className="workspace__footer-dot">·</span>
          <span>{isReady ? 'Ready when you are' : 'Initializing…'}</span>
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
