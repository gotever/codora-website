import { useState, useRef, useMemo } from 'react'
import type { CodingChallenge } from '../../../../data/lessons'
import { highlightPythonDark } from '../../utils/highlight'
import { usePyodide } from '../../../../hooks/usePyodide'
import './EmbeddedChallenge.css'

interface EmbeddedChallengeProps {
  challenge: CodingChallenge
  onAskAIHint?: (challengeTitle: string) => void
}

type RunStatus = 'idle' | 'running' | 'success' | 'fail' | 'error'

interface CaseResult {
  id: string
  call: string
  expected: string
  actual?: string
  passed?: boolean
}

export default function EmbeddedChallenge({
  challenge,
  onAskAIHint,
}: EmbeddedChallengeProps) {
  const [code, setCode] = useState(challenge.initialCode)
  const [isRunning, setIsRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null)
  const [consoleError, setConsoleError] = useState<string | null>(null)
  const [caseResults, setCaseResults] = useState<CaseResult[]>(
    challenge.testCases.map((tc) => ({ id: tc.id, call: tc.call, expected: tc.expected }))
  )

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => code.split('\n'), [code])
  const highlightedCode = useMemo(() => highlightPythonDark(code), [code])

  const { runPython, isReady, isLoading } = usePyodide()

  // Determine if the challenge is stdout-based (call === 'stdout')
  const isStdoutChallenge = challenge.testCases.every((tc) => tc.call === 'stdout')

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
      setCode(updated)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4
      })
    }
  }

  const handleReset = () => {
    setCode(challenge.initialCode)
    setRunStatus('idle')
    setConsoleOutput(null)
    setConsoleError(null)
    setCaseResults(
      challenge.testCases.map((tc) => ({ id: tc.id, call: tc.call, expected: tc.expected }))
    )
  }

  const handleRunCode = async () => {
    if (!isReady || isRunning) return
    setIsRunning(true)
    setRunStatus('running')
    setConsoleOutput(null)
    setConsoleError(null)

    const result = await runPython(code)

    setIsRunning(false)

    if (!result.success) {
      setRunStatus('error')
      setConsoleError(result.error)
      setCaseResults(
        challenge.testCases.map((tc) => ({ id: tc.id, call: tc.call, expected: tc.expected }))
      )
      return
    }

    const stdout = result.output.trim()
    setConsoleOutput(stdout || '(no output)')

    if (isStdoutChallenge) {
      // Compare stdout against each expected value
      const updated = challenge.testCases.map((tc) => {
        const passed = stdout === tc.expected.trim()
        return { id: tc.id, call: tc.call, expected: tc.expected, actual: stdout, passed }
      })
      setCaseResults(updated)
      setRunStatus(updated.every((r) => r.passed) ? 'success' : 'fail')
    } else {
      // For function-based challenges just show output, don't auto-evaluate
      setCaseResults(
        challenge.testCases.map((tc) => ({ id: tc.id, call: tc.call, expected: tc.expected }))
      )
      setRunStatus('idle')
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
              onChange={(e) => setCode(e.target.value)}
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
          onClick={() => onAskAIHint?.(challenge.title)}
        >
          Ask AI for a hint →
        </button>
      </div>
    </div>
  )
}
