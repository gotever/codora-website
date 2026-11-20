import { useState, useRef, useMemo } from 'react'
import type { CodingChallenge, LessonChallengeContext } from '../../../../data/lessons'
import { highlightPythonDark } from '../../utils/highlight'
import { usePyodide } from '../../../../hooks/usePyodide'
import './EmbeddedChallenge.css'

interface EmbeddedChallengeProps {
  challenge: CodingChallenge
  lessonId: string | number
  userId?: string
  onAskAIHint?: (context: LessonChallengeContext) => void
  onContextChange?: (context: LessonChallengeContext) => void
  onPassed?: (challengeId: string) => void | Promise<void>
}

type RunStatus = 'idle' | 'running' | 'success' | 'fail' | 'error'

interface CaseResult {
  id: string
  call: string
  expected: string
  actual?: string
  passed?: boolean
}

function getChallengeDraftKey(lessonId: string | number, challengeId: string, userId?: string) {
  return `codora:lesson-challenge-draft:v1:${userId ?? 'guest'}:${lessonId}:${challengeId}`
}

function getTestCaseLabel(testCase: { call: string; input?: string }) {
  return testCase.input === undefined ? testCase.call : `stdin: ${testCase.input.trim() || '(empty)'}`
}

function readChallengeDraft(lessonId: string | number, challengeId: string, userId: string | undefined, initialCode: string) {
  try {
    return localStorage.getItem(getChallengeDraftKey(lessonId, challengeId, userId)) ?? initialCode
  } catch {
    return initialCode
  }
}

function writeChallengeDraft(lessonId: string | number, challengeId: string, userId: string | undefined, code: string) {
  try {
    localStorage.setItem(getChallengeDraftKey(lessonId, challengeId, userId), code)
  } catch {
    // Keep editing available when browser storage is unavailable or full.
  }
}

export default function EmbeddedChallenge({
  challenge,
  lessonId,
  userId,
  onAskAIHint,
  onContextChange,
  onPassed,
}: EmbeddedChallengeProps) {
  const [code, setCode] = useState(() => readChallengeDraft(lessonId, challenge.id, userId, challenge.initialCode))
  const [isRunning, setIsRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null)
  const [consoleError, setConsoleError] = useState<string | null>(null)
  const [caseResults, setCaseResults] = useState<CaseResult[]>(
    challenge.testCases.map((tc) => ({ id: tc.id, call: getTestCaseLabel(tc), expected: tc.expected }))
  )

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => code.split('\n'), [code])
  const highlightedCode = useMemo(() => highlightPythonDark(code), [code])

  const { runPython, isReady, isLoading } = usePyodide()

  const reportContext = (currentCode: string, runResult: string) => {
    onContextChange?.({ title: challenge.title, description: challenge.description, code: currentCode, runResult })
  }

  const handleCodeChange = (currentCode: string) => {
    setCode(currentCode)
    writeChallengeDraft(lessonId, challenge.id, userId, currentCode)
    reportContext(currentCode, 'The code was edited after the previous run, so there is no current run result.')
  }

  // Program challenges run once per stdout/stdin case; other cases call a function.
  const isProgramChallenge = challenge.testCases.every((tc) => tc.call === 'stdout' || tc.input !== undefined)

  // Synchronize scrolling
  const handleScroll = () => {
    if (!textareaRef.current) return
    const { scrollTop, scrollLeft } = textareaRef.current
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop
    }
  }

  // Handle Tab key for 4 spaces indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const updated = code.substring(0, start) + '    ' + code.substring(end)
      handleCodeChange(updated)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4
      })
    }
  }

  const handleReset = () => {
    handleCodeChange(challenge.initialCode)
    setRunStatus('idle')
    setConsoleOutput(null)
    setConsoleError(null)
    setCaseResults(
      challenge.testCases.map((tc) => ({ id: tc.id, call: getTestCaseLabel(tc), expected: tc.expected }))
    )
  }

  const handleRunCode = async () => {
    if (!isReady || isRunning) return
    setIsRunning(true)
    setRunStatus('running')
    setConsoleOutput(null)
    setConsoleError(null)
    reportContext(code, 'The learner is currently running this code.')

    if (isProgramChallenge) {
      const updated: CaseResult[] = []
      let firstError: string | null = null
      for (const testCase of challenge.testCases) {
        const result = await runPython(code, testCase.input)
        if (!result.success && !firstError) firstError = result.error
        const actual = result.success ? result.output.trim() : result.error
        updated.push({
          id: testCase.id,
          call: getTestCaseLabel(testCase),
          expected: testCase.expected,
          actual,
          passed: result.success && actual === testCase.expected.trim(),
        })
      }
      setIsRunning(false)
      setCaseResults(updated)
      if (firstError) {
        setRunStatus('error')
        setConsoleOutput(null)
        setConsoleError(firstError)
        reportContext(code, `Run failed with Python error: ${firstError}`)
        return
      }
      const allCasesPassed = updated.length > 0 && updated.every((result) => result.passed)
      setRunStatus(allCasesPassed ? 'success' : 'fail')
      setConsoleError(null)
      setConsoleOutput(updated.map((result) => `${result.call} ? ${result.actual || '(no output)'}`).join('\n'))
      reportContext(code, `Run ${allCasesPassed ? 'passed' : 'failed'}. Test cases: ${updated.map((result) => `${result.passed ? 'passed' : 'failed'} ${result.call}, expected ${result.expected}, got ${result.actual ?? ''}`).join('; ')}`)
      if (allCasesPassed) {
        try {
          await onPassed?.(challenge.id)
        } catch {
          const message = 'Code challenge passed, but progress could not be saved. Run it again to retry.'
          setConsoleError(message)
          reportContext(code, message)
        }
      }
    } else {
      const results: CaseResult[] = []
      let firstError: string | null = null
      for (const testCase of challenge.testCases) {
        const result = await runPython(`${code}\nstr(${testCase.call})`)
        if (!result.success && !firstError) firstError = result.error
        const actual = result.success ? result.returnValue ?? result.output.trim() : result.error
        results.push({
          id: testCase.id,
          call: testCase.call,
          expected: testCase.expected,
          actual,
          passed: result.success && actual.trim() === testCase.expected.trim(),
        })
      }
      setIsRunning(false)
      setCaseResults(results)
      if (firstError) {
        setConsoleOutput(null)
        setConsoleError(firstError)
        setRunStatus('error')
        reportContext(code, `Run failed with Python error: ${firstError}`)
        return
      }
      setConsoleOutput(results.map((result) => `${result.call} → ${result.actual}`).join('\n') || '(no output)')
      const allCasesPassed = results.length > 0 && results.every((result) => result.passed)
      setRunStatus(allCasesPassed ? 'success' : 'fail')
      reportContext(code, `Run ${allCasesPassed ? 'passed' : 'failed'}. Test cases: ${results.map((result) => `${result.passed ? 'passed' : 'failed'} ${result.call}, expected ${result.expected}, got ${result.actual ?? ''}`).join('; ')}`)
      if (allCasesPassed) {
        try {
          await onPassed?.(challenge.id)
        } catch {
          const message = 'Code challenge passed, but progress could not be saved. Run it again to retry.'
          setConsoleError(message)
          reportContext(code, message)
        }
      }
    }
  }

  const passedCount = caseResults.filter((r) => r.passed === true).length
  const totalCount = caseResults.length
  const allPassed = passedCount === totalCount && runStatus === 'success'

  return (
    <div className="embedded-challenge" role="region" aria-label={`Coding challenge: ${challenge.title}`}>
      {/* Top Header */}
      <div className="embedded-challenge__top">
        <span className="embedded-challenge__badge">Code challenge</span>
        <span className="embedded-challenge__practice-label">{challenge.practiceLabel}</span>
      </div>

      {/* Challenge Title & Description */}
      <h3 className="embedded-challenge__title">{challenge.title}</h3>
      <p className="embedded-challenge__desc">{challenge.description}</p>

      {/* Pyodide loading state */}
      {isLoading && (
        <div className="embedded-challenge__pyodide-notice">
          <span className="embedded-challenge__pyodide-dot" />
          Loading Python runtime…
        </div>
      )}

      {/* Code Editor Container */}
      <div className="embedded-challenge__editor">
        {/* Editor Top Bar */}
        <div className="embedded-challenge__editor-header">
          <span className="embedded-challenge__filename">{challenge.filename}</span>
          <span className="embedded-challenge__language">{challenge.language}</span>
        </div>

        {/* Editor Body */}
        <div className="embedded-challenge__editor-body">
          {/* Line Numbers Gutter */}
          <div ref={lineNumbersRef} className="embedded-challenge__gutter" aria-hidden="true">
            {lines.map((_, i) => (
              <span key={i} className="embedded-challenge__line-num">
                {i + 1}
              </span>
            ))}
          </div>

          {/* Interactive Editing Area */}
          <div className="embedded-challenge__stage">
            <pre
              ref={preRef}
              className="embedded-challenge__highlight"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
            />
            <textarea
              ref={textareaRef}
              className="embedded-challenge__textarea"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              aria-label="Challenge code editor"
            />
          </div>
        </div>
      </div>

      {/* Console Output */}
      {(consoleOutput !== null || consoleError !== null) && (
        <div className="embedded-challenge__console">
          <div className="embedded-challenge__console-header">
            <span className="embedded-challenge__console-prompt">&gt;_</span>
            <span>Output</span>
          </div>
          <pre className={`embedded-challenge__console-body ${consoleError ? 'embedded-challenge__console-body--error' : ''}`}>
            {consoleError ?? consoleOutput}
          </pre>
        </div>
      )}

      {/* Test Cases */}
      <div className="embedded-challenge__testcases">
        <div className="embedded-challenge__testcases-header">
          <span className="embedded-challenge__testcases-title">Test cases</span>
          <span
            className={`embedded-challenge__overall-status ${
              runStatus === 'success'
                ? 'embedded-challenge__overall-status--passed'
                : runStatus === 'fail' || runStatus === 'error'
                ? 'embedded-challenge__overall-status--failed'
                : ''
            }`}
          >
            {runStatus === 'idle'
              ? 'Not run yet'
              : runStatus === 'running'
              ? 'Running…'
              : runStatus === 'error'
              ? 'Runtime error'
              : runStatus === 'success'
              ? `All ${totalCount} test ${totalCount === 1 ? 'case' : 'cases'} passed ✓`
              : `${passedCount} / ${totalCount} passed`}
          </span>
        </div>

        <div className="embedded-challenge__cases-list">
          {caseResults.map((tc) => (
            <div key={tc.id} className="embedded-challenge__case-row">
              <span className="embedded-challenge__case-call">{tc.call}</span>
              <span className="embedded-challenge__case-expected">
                Expected: <code>{tc.expected}</code>
                {tc.actual !== undefined && !tc.passed && (
                  <span className="embedded-challenge__case-actual"> · Got: <code>{tc.actual}</code></span>
                )}
              </span>
              <span
                className={`embedded-challenge__case-status ${
                  tc.passed === true
                    ? 'embedded-challenge__case-status--passed'
                    : tc.passed === false
                    ? 'embedded-challenge__case-status--failed'
                    : ''
                }`}
              >
                {tc.passed === true ? 'Passed ✓' : tc.passed === false ? 'Failed ✗' : 'Not run'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Success Banner */}
      {allPassed && (
        <div className="embedded-challenge__success-banner">
          🎉 Great work! Your code produces the correct output.
        </div>
      )}

      {/* Action Buttons Bar */}
      <div className="embedded-challenge__actions">
        <div className="embedded-challenge__actions-left">
          <button
            type="button"
            className="embedded-challenge__btn-run"
            onClick={handleRunCode}
            disabled={isRunning || isLoading}
          >
            {isRunning ? 'Running…' : 'Run code'}
          </button>
          <button
            type="button"
            className="embedded-challenge__btn-reset"
            onClick={handleReset}
            disabled={isRunning}
          >
            Reset
          </button>
        </div>

        <button
          type="button"
          className="embedded-challenge__btn-hint"
          onClick={() => onAskAIHint?.({
            title: challenge.title,
            description: challenge.description,
            code,
            runResult: runStatus === 'idle'
              ? 'The learner has not run this code yet.'
              : `Latest run status: ${runStatus}. ${consoleError ? `Error: ${consoleError}` : consoleOutput ? `Output: ${consoleOutput}` : ''}`,
          })}
        >
          Ask AI for a hint →
        </button>
      </div>
    </div>
  )
}
