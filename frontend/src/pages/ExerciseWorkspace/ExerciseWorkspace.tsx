import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { EXERCISES, TEST_CASES, type Exercise, type TestCase } from '../../data/exercises'
import { ApiError, fetchExercise, fetchExerciseSubmissions, fetchExerciseWorkspace, fetchExercises, fetchProgress, saveExerciseWorkspace, saveProgress, submitExercise, type ApiExercise, type ApiSubmissionHistoryEntry, type SubmitResult } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'

const CONSECUTIVE_ERRORS_KEY = 'codora:consecutive-errors'

function updateConsecutiveErrorSession(allPassed: boolean) {
  try {
    const current = Number(sessionStorage.getItem(CONSECUTIVE_ERRORS_KEY) ?? 0)
    sessionStorage.setItem(CONSECUTIVE_ERRORS_KEY, String(allPassed ? 0 : (Number.isFinite(current) ? current : 0) + 1))
  } catch {
    // Personalization state is optional when browser storage is unavailable.
  }
}

function getProgressExerciseId(exerciseId: Exercise['id']): number | null {
  const numericId = Number(exerciseId)
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null
}

type SubmissionHistoryItem = {
  id: string
  time: string
  status: SubmitResult['status']
  runtime: string
  memory: string
  code: string
}

type ExerciseRunResult = {
  status: 'idle' | 'running' | 'success' | 'error'
  operation?: 'run' | 'submit'
  message?: string
  stdout?: string
  summary?: {
    label: string
    passedCount?: number
    totalCount?: number
    runtimeMs?: number
    failedCase?: {
      label?: string
      hidden?: boolean
      expected?: string
      actual?: string
      error?: string
    }
  }
  results?: {
    caseId: string
    label?: string
    inputLabel?: string
    input?: string
    inputs?: { label: string; value: string }[]
    expectedOutput?: string
    passed: boolean
    actualOutput: string
    error?: string
    executionTime?: number
  }[]
}

type StoredExerciseWorkspace = {
  draft_code: string
  latest_run_code: string | null
  latest_run_result: ExerciseRunResult | null
  updated_at: string
}

const exerciseWorkspaceStorageKey = (exerciseId: string | number, ownerId: string) => `codora:exercise-workspace:${ownerId}:${exerciseId}`
const exerciseSubmissionStorageKey = (exerciseId: string | number, ownerId: string) => `codora:exercise-submissions:${ownerId}:${exerciseId}`

function readStoredWorkspace(exerciseId: string | number, ownerId: string): StoredExerciseWorkspace | null {
  try {
    const stored = localStorage.getItem(exerciseWorkspaceStorageKey(exerciseId, ownerId))
    return stored ? JSON.parse(stored) as StoredExerciseWorkspace : null
  } catch {
    return null
  }
}

function writeStoredWorkspace(exerciseId: string | number, ownerId: string, workspace: Omit<StoredExerciseWorkspace, 'updated_at'>) {
  try {
    localStorage.setItem(exerciseWorkspaceStorageKey(exerciseId, ownerId), JSON.stringify({ ...workspace, updated_at: new Date().toISOString() }))
  } catch {
    // Keep the editor usable when browser storage is unavailable or full.
  }
}

function readStoredSubmissions(exerciseId: string | number, ownerId: string): SubmissionHistoryItem[] {
  try {
    const stored = localStorage.getItem(exerciseSubmissionStorageKey(exerciseId, ownerId))
    return stored ? JSON.parse(stored) as SubmissionHistoryItem[] : []
  } catch {
    return []
  }
}

function writeStoredSubmission(exerciseId: string | number, ownerId: string, submission: SubmissionHistoryItem) {
  try {
    const submissions = readStoredSubmissions(exerciseId, ownerId).filter((item) => item.id !== submission.id)
    localStorage.setItem(exerciseSubmissionStorageKey(exerciseId, ownerId), JSON.stringify([submission, ...submissions].slice(0, 50)))
  } catch {
    // Submission history remains available from the account API when browser storage is unavailable.
  }
}

function mapSubmissionHistoryEntry(entry: ApiSubmissionHistoryEntry): SubmissionHistoryItem {
  return {
    id: entry.id,
    time: new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
    status: entry.status,
    runtime: `${entry.runtime_ms} ms`,
    memory: 'Backend runner',
    code: entry.code,
  }
}
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
  const location = useLocation()
  const { user } = useAuth()
  const storageOwnerId = user?.id ?? 'guest'
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
  const [executionTab, setExecutionTab] = useState<'testcases' | 'output'>('testcases')
  const [code, setCode] = useState<string>(exercise.initialCode)
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExerciseCompleted, setIsExerciseCompleted] = useState(false)
  const [isAITutorOpen, setIsAITutorOpen] = useState(false)
  const [nudgeAccordionOpen, setNudgeAccordionOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchProgress().then((progress) => {
      if (!active) return
      setIsExerciseCompleted(progress.some((item) =>
        item.item_type === 'exercise' && item.item_id === String(exercise.id) && item.status === 'completed',
      ))
    }).catch(() => {
      if (active) setIsExerciseCompleted(false)
    })
    return () => { active = false }
  }, [exercise.id])

  // Test cases for this exercise
  const testCases: TestCase[] = apiExercise?.test_cases.runner ?? TEST_CASES[String(fallbackExercise.id)] ?? TEST_CASES['sum-of-even-numbers']

  // Execution result state
  const [runResult, setRunResult] = useState<ExerciseRunResult>({ status: 'idle' })
  const [latestRunCode, setLatestRunCode] = useState<string | null>(null)
  const codeEditedRef = useRef(false)
  const activeWorkspaceExerciseIdRef = useRef<string | null>(null)
  const activeWorkspaceOwnerIdRef = useRef<string | null>(null)
  const [workspaceRestoredExerciseId, setWorkspaceRestoredExerciseId] = useState<number | null>(null)
  const [workspaceSyncExerciseId, setWorkspaceSyncExerciseId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const exerciseId = String(exercise.id)
    const numericExerciseId = getProgressExerciseId(exercise.id)
    const stored = readStoredWorkspace(exerciseId, storageOwnerId)
    const isNewWorkspace = activeWorkspaceExerciseIdRef.current !== exerciseId || activeWorkspaceOwnerIdRef.current !== storageOwnerId
    if (isNewWorkspace) {
      activeWorkspaceExerciseIdRef.current = exerciseId
      activeWorkspaceOwnerIdRef.current = storageOwnerId
      codeEditedRef.current = false
      setCode(stored?.draft_code ?? exercise.initialCode)
      setLatestRunCode(stored?.latest_run_code ?? null)
      setRunResult(stored?.latest_run_result ?? { status: 'idle' })
      setExecutionTab(stored?.latest_run_result ? 'output' : 'testcases')
      setIsExerciseCompleted(false)
    }
    setWorkspaceRestoredExerciseId(null)
    setWorkspaceSyncExerciseId(null)

    const finishRestore = () => {
      if (active && numericExerciseId !== null) setWorkspaceRestoredExerciseId(numericExerciseId)
    }

    if (numericExerciseId === null) {
      finishRestore()
      return () => { active = false }
    }

    fetchExerciseWorkspace(numericExerciseId).then((remote) => {
      if (!active) return
      setWorkspaceSyncExerciseId(numericExerciseId)
      const localIsNewer = stored && (!remote.updated_at || stored.updated_at >= remote.updated_at)
      const restoredDraft = localIsNewer ? stored?.draft_code : remote.draft_code
      const restoredRunResult = localIsNewer ? stored?.latest_run_result : remote.latest_run_result as ExerciseRunResult | null
      const restoredRunCode = localIsNewer ? stored?.latest_run_code : remote.latest_run_code

      if (!codeEditedRef.current && restoredDraft !== null && restoredDraft !== undefined) setCode(restoredDraft)
      if (!codeEditedRef.current) setLatestRunCode(restoredRunCode ?? null)
      if (!codeEditedRef.current && restoredRunResult) {
        setRunResult(restoredRunResult)
        setExecutionTab('output')
      }
      if (!localIsNewer && remote.draft_code !== null) {
        writeStoredWorkspace(exerciseId, storageOwnerId, {
          draft_code: remote.draft_code,
          latest_run_code: remote.latest_run_code,
          latest_run_result: restoredRunResult,
        })
      }
    }).catch(() => undefined).finally(finishRestore)

    return () => { active = false }
  }, [exercise.id, exercise.initialCode, storageOwnerId])

  useEffect(() => {
    const exerciseId = getProgressExerciseId(exercise.id)
    if (exerciseId === null || workspaceRestoredExerciseId !== exerciseId) return

    const currentStored = readStoredWorkspace(exercise.id, storageOwnerId)
    const latestRunResult = runResult.status === 'success' || runResult.status === 'error'
      ? runResult
      : currentStored?.latest_run_result ?? null
    const savedRunCode = latestRunCode ?? currentStored?.latest_run_code ?? null

    writeStoredWorkspace(exercise.id, storageOwnerId, {
      draft_code: code,
      latest_run_code: savedRunCode,
      latest_run_result: latestRunResult,
    })

    if (workspaceSyncExerciseId !== exerciseId) return
    const timeout = window.setTimeout(() => {
      void saveExerciseWorkspace(exerciseId, {
        draft_code: code,
        latest_run_code: savedRunCode,
        latest_run_result: latestRunResult,
      }).catch(() => setWorkspaceSyncExerciseId(null))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [code, exercise.id, latestRunCode, runResult, storageOwnerId, workspaceRestoredExerciseId, workspaceSyncExerciseId])

  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<{
    locationKey: string
    exerciseId: string
    submissionId: string
  } | null>(null)
  const submissionCodeView = selectedSubmission?.locationKey === location.key
    && selectedSubmission.exerciseId === String(exercise.id)
    ? submissions.find((submission) => submission.id === selectedSubmission.submissionId) ?? null
    : null
  const [loadedSubmissionExerciseId, setLoadedSubmissionExerciseId] = useState<number | null>(null)
  const [submissionHistoryError, setSubmissionHistoryError] = useState<{
    exerciseId: number
    type: 'sign-in' | 'load'
  } | null>(null)
  const apiExerciseId = apiExercise?.id
  const isLoadingSubmissionHistory = apiExerciseId !== undefined && loadedSubmissionExerciseId !== apiExerciseId
  const submissionHistoryErrorType = submissionHistoryError && submissionHistoryError.exerciseId === apiExerciseId
    ? submissionHistoryError.type
    : null

  useEffect(() => {
    if (apiExerciseId === undefined) return

    let active = true
    fetchExerciseSubmissions(apiExerciseId).then((history) => {
      if (active) {
        setSubmissions(history.map(mapSubmissionHistoryEntry))
        setSubmissionHistoryError(null)
        setLoadedSubmissionExerciseId(apiExerciseId)
      }
    }).catch((error: unknown) => {
      if (!active) return
      setSubmissions(readStoredSubmissions(apiExerciseId, storageOwnerId))
      setSubmissionHistoryError({
        exerciseId: apiExerciseId,
        type: error instanceof ApiError && error.status === 401 ? 'sign-in' : 'load',
      })
      setLoadedSubmissionExerciseId(apiExerciseId)
    })
    return () => { active = false }
  }, [apiExerciseId, storageOwnerId])

  // Reset code handler
  const handleResetCode = () => {
    if (window.confirm('Reset code to the original starter template?')) {
      codeEditedRef.current = true
      setCode(exercise.initialCode)
    }
  }

  const handleCodeChange = (nextCode: string) => {
    codeEditedRef.current = true
    setCode(nextCode)
    writeStoredWorkspace(exercise.id, storageOwnerId, {
      draft_code: nextCode,
      latest_run_code: latestRunCode,
      latest_run_result: runResult.status === 'success' || runResult.status === 'error'
        ? runResult
        : readStoredWorkspace(exercise.id, storageOwnerId)?.latest_run_result ?? null,
    })
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
    updateConsecutiveErrorSession(allPassed)
    const progressExerciseId = getProgressExerciseId(exercise.id)
    if (progressExerciseId !== null && totalCount > 0) {
      void saveProgress(progressExerciseId, 'exercise', allPassed || isExerciseCompleted ? 'completed' : 'in_progress', passedCount / totalCount * 10).catch(() => undefined)
    }

    const firstError = results.find((r) => !r.passed)

    setRunResult({
      status: allPassed ? 'success' : 'error',
      operation: 'run',
      message: allPassed
        ? `All test cases executed successfully. (${totalTime}ms)`
        : `Test failed: ${passedCount}/${totalCount} passed.${
            firstError?.error ? `\n${firstError.error}` : ''
          }`,
      stdout: results.map((r) => {
        const tc = testCases.find((t) => t.id === r.caseId)
        return `${tc?.label}: ${r.passed ? '✓ PASS' : '✗ FAIL'} → ${r.actualOutput} (${r.executionTime}ms)`
      }).join('\n'),
      summary: {
        label: allPassed ? 'Accepted' : 'Wrong Answer',
        passedCount,
        totalCount,
        runtimeMs: totalTime,
        failedCase: firstError ? {
          label: testCases.find((testCase) => testCase.id === firstError.caseId)?.label,
          expected: testCases.find((testCase) => testCase.id === firstError.caseId)?.expectedOutput,
          actual: firstError.actualOutput,
          error: firstError.error,
        } : undefined,
      },
      results,
    })
    setLatestRunCode(code)

    setIsRunning(false)
  }

  // Submit code to the backend runner; fall back to browser evaluation when it is unavailable.
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setRunResult({ status: 'running', message: 'Submitting solution to backend runner…' })

    try {
      const result: SubmitResult = await submitExercise(String(exercise.id), code)
      const allPassed = result.status === 'Accepted'
      if (allPassed) setIsExerciseCompleted(true)
      updateConsecutiveErrorSession(allPassed)
      const details = [`Status: ${result.status}`, `Passed: ${result.passed_count}/${result.total_count} test cases`, `Runtime: ${result.runtime_ms} ms`]
      if (result.failed_case?.is_hidden) {
        details.push('Failed on a hidden test case.')
      } else if (result.failed_case) {
        details.push(`Failed on: ${result.failed_case.label || result.failed_case.case_id || 'test case'}`)
        if (result.failed_case.expected !== undefined) {
          details.push(`Expected: ${result.failed_case.expected}`, `Actual: ${result.failed_case.actual ?? ''}`)
        }
      }
      if (result.error) details.push(`Error: ${result.error}`)

      setRunResult({
        status: allPassed ? 'success' : 'error',
        operation: 'submit',
        message: allPassed
          ? `Accepted! All ${result.total_count}/${result.total_count} test cases passed.`
          : `Submission result: ${result.status} (${result.passed_count}/${result.total_count} passed).`,
        stdout: details.join('\n'),
        summary: {
          label: result.status,
          passedCount: result.passed_count,
          totalCount: result.total_count,
          runtimeMs: result.runtime_ms,
          failedCase: result.failed_case ? {
            label: result.failed_case.label || result.failed_case.case_id,
            hidden: result.failed_case.is_hidden,
            expected: result.failed_case.expected,
            actual: result.failed_case.actual,
            error: result.failed_case.error || result.error || undefined,
          } : undefined,
        },
        results: result.case_results?.map((caseResult) => ({
          caseId: caseResult.case_id,
          label: caseResult.label,
          inputLabel: caseResult.input_label,
          input: caseResult.input,
          inputs: caseResult.inputs,
          expectedOutput: caseResult.expected,
          passed: caseResult.passed,
          actualOutput: caseResult.actual ?? caseResult.error ?? '',
          error: caseResult.error,
          executionTime: caseResult.execution_time_ms,
        })),
      })
      setLatestRunCode(code)
      setSubmissions((previous) => [{
        id: String(Date.now()),
        time: 'Just now',
        status: allPassed ? 'Accepted' : 'Wrong Answer',
        runtime: `${result.runtime_ms} ms`,
        memory: 'Backend runner',
        code,
      }, ...previous])
      void fetchExerciseSubmissions(Number(exercise.id)).then((history) => {
        setSubmissions(history.map(mapSubmissionHistoryEntry))
        setSubmissionHistoryError(null)
        setLoadedSubmissionExerciseId(Number(exercise.id))
      }).catch(() => undefined)
      return
    } catch (error) {
      console.warn('Backend submission unavailable; falling back to browser evaluation.', error)
      if (!isReady) {
        setRunResult({
          status: 'error',
          operation: 'submit',
          message: 'Backend runner is unavailable and Python runtime is still loading. Please start the backend or wait for Pyodide.',
          summary: { label: 'Runner unavailable' },
        })
        return
      }

      const startTime = performance.now()
      const results = []
      for (const testCase of testCases) results.push(await executeTestCase(testCase))

      const totalTime = Math.round(performance.now() - startTime)
      const allPassed = results.every((result) => result.passed)
      const passedCount = results.filter((result) => result.passed).length
      const totalCount = results.length
      updateConsecutiveErrorSession(allPassed)
      const progressExerciseId = getProgressExerciseId(exercise.id)
      if (progressExerciseId !== null && totalCount > 0) {
        void saveProgress(progressExerciseId, 'exercise', allPassed || isExerciseCompleted ? 'completed' : 'in_progress', passedCount / totalCount * 10).catch(() => undefined)
      }
      if (allPassed) setIsExerciseCompleted(true)

      setRunResult({
        status: allPassed ? 'success' : 'error',
        operation: 'submit',
        message: allPassed
          ? `Accepted! (Browser-evaluated) All ${totalCount}/${totalCount} test cases passed.`
          : `Submission failed: ${passedCount}/${totalCount} test cases passed.`,
        stdout: results.map((result) => {
          const testCase = testCases.find((item) => item.id === result.caseId)
          return `${testCase?.label}: ${result.passed ? '✓ PASS' : '✗ FAIL'} → ${result.actualOutput} (${result.executionTime}ms)`
        }).join('\n'),
        summary: {
          label: allPassed ? 'Accepted (Browser)' : 'Wrong Answer (Browser)',
          passedCount,
          totalCount,
          runtimeMs: totalTime,
          failedCase: (() => {
            const failed = results.find((result) => !result.passed)
            const failedTestCase = failed && testCases.find((testCase) => testCase.id === failed.caseId)
            return failed && failedTestCase ? {
              label: failedTestCase.label,
              expected: failedTestCase.expectedOutput,
              actual: failed.actualOutput,
              error: failed.error,
            } : undefined
          })(),
        },
        results,
      })
      setLatestRunCode(code)
      const localSubmission: SubmissionHistoryItem = {
        id: `local-${Date.now()}`,
        time: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        status: allPassed ? 'Accepted' : 'Wrong Answer',
        runtime: `${totalTime} ms`,
        memory: '~14 MB (Browser)',
        code,
      }
      writeStoredSubmission(exercise.id, storageOwnerId, localSubmission)
      setSubmissions((previous) => [{
        ...localSubmission,
        time: 'Just now',
      }, ...previous])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="workspace">
      {/* 1. Workspace Subheader / Breadcrumbs & Navigation Bar */}
      <nav
        className={`workspace__breadcrumb-bar ${isAITutorOpen ? 'workspace__breadcrumb-bar--tutor-open' : ''}`}
        aria-label="Exercise navigation"
      >
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
          {isExerciseCompleted && <span className="workspace__completed-badge">✓ Completed</span>}
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
          <div className="workspace__run-submit-actions">
            <button
              type="button"
              className="exec-panel__btn-run"
              onClick={() => {
                setExecutionTab('output')
                void handleRun()
              }}
              disabled={isRunning || isSubmitting || !isReady || !!submissionCodeView}
              title={submissionCodeView ? 'Return to draft before running code.' : !isReady ? 'Waiting for Python runtime…' : 'Run code'}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{isRunning ? 'Running…' : !isReady ? 'Loading…' : 'Run'}</span>
            </button>
            <button
              type="button"
              className="exec-panel__btn-submit"
              onClick={() => {
                setExecutionTab('output')
                void handleSubmit()
              }}
              disabled={isRunning || isSubmitting || !!submissionCodeView}
              title={submissionCodeView ? 'Return to draft before submitting code.' : isSubmitting ? 'Submitting to judge…' : 'Submit solution to judge'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              <span>{isSubmitting ? 'Submitting…' : 'Submit'}</span>
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
      <main className={`workspace__main ${isAITutorOpen ? 'workspace__main--tutor-open' : ''}`}>
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
                  {isLoadingSubmissionHistory ? (
                    <div className="workspace__submissions-empty"><p>Loading submission history…</p></div>
                  ) : submissions.length === 0 && submissionHistoryErrorType === 'sign-in' ? (
                    <div className="workspace__submissions-empty">
                      <p>Sign in to view saved submissions.</p>
                      <p className="workspace__submissions-subtitle">Submissions are saved to your account when you are signed in.</p>
                    </div>
                  ) : submissions.length === 0 && submissionHistoryErrorType ? (
                    <div className="workspace__submissions-empty">
                      <p>Could not load submission history.</p>
                      <p className="workspace__submissions-subtitle">Please refresh the page and try again.</p>
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="workspace__submissions-empty">
                      <p>No submissions yet.</p>
                      <p className="workspace__submissions-subtitle">
                        Click the blue <strong>Submit</strong> button on the bottom right to test your solution.
                      </p>
                    </div>
                  ) : (
                    <div className="workspace__submissions-list">
                      {submissions.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className={`workspace__submission-item ${submissionCodeView?.id === sub.id ? 'workspace__submission-item--selected' : ''}`}
                          aria-pressed={submissionCodeView?.id === sub.id}
                          onClick={() => setSelectedSubmission({
                            locationKey: location.key,
                            exerciseId: String(exercise.id),
                            submissionId: sub.id,
                          })}
                        >
                          <div className="workspace__submission-header">
                            <span
                              className={`workspace__submission-badge ${
                                sub.status === 'Accepted'
                                  ? 'workspace__submission-badge--accepted'
                                  : 'workspace__submission-badge--wrong'
                              }`}
                            >
                              {sub.status === 'Accepted' ? '✓ Accepted' : `✗ ${sub.status}`}
                            </span>
                            <span className="workspace__submission-time">{sub.time}</span>
                          </div>
                          <div className="workspace__submission-meta">
                            <span>Runtime: {sub.runtime}</span>
                            <span>Memory: {sub.memory}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Code Editor + Execution Console Panel */}
        <section className={`workspace__right-panel ${isAITutorOpen ? 'workspace__right-panel--tutor-open' : ''}`} aria-label="Code and Execution">
          <div className="workspace__coding-area">
            <div className="workspace__editor-slot">
              <WorkspaceCodeEditor
                value={submissionCodeView?.code ?? code}
                onChange={handleCodeChange}
                filename={exercise.filename}
                onReset={handleResetCode}
                readOnly={!!submissionCodeView}
                statusLabel={submissionCodeView
                  ? `Submission · ${submissionCodeView.status} · ${submissionCodeView.time}`
                  : undefined}
                onExitReadOnly={() => setSelectedSubmission(null)}
              />
            </div>

          </div>

          {/* Bottom: Console & Test Cases Panel */}
          <div className="workspace__console-slot">
            <ExecutionPanel
              testCases={testCases}
              activeTab={executionTab}
              onActiveTabChange={setExecutionTab}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              runResult={runResult}
              pyodideLoading={pyodideLoading}
            />
          </div>

          <AITutorPanel
            key={exercise.id}
            exercise={exercise}
            currentCode={code}
            currentActivity={`${runResult.status === 'idle' ? 'No code execution yet.' : runResult.message ?? runResult.status}${runResult.stdout ? `\n${runResult.stdout}` : ''}`}
            isOpen={isAITutorOpen}
            onToggle={() => setIsAITutorOpen((v) => !v)}
          />
        </section>
      </main>

    </div>
  )
}
