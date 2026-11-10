import { useState, useRef, useMemo } from 'react'
import type { CodingChallenge } from '../../../../data/lessons'
import { highlightPythonDark } from '../../utils/highlight'
import './EmbeddedChallenge.css'

interface EmbeddedChallengeProps {
  challenge: CodingChallenge
  onAskAIHint?: (challengeTitle: string) => void
}

export default function EmbeddedChallenge({
  challenge,
  onAskAIHint,
}: EmbeddedChallengeProps) {
  const [code, setCode] = useState(challenge.initialCode)
  const [isRunning, setIsRunning] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [testResults, setTestResults] = useState<{
    status: 'idle' | 'running' | 'success' | 'fail'
    cases: {
      id: string
      call: string
      expected: string
      actual?: string
      passed?: boolean
    }[]
  }>({
    status: 'idle',
    cases: challenge.testCases.map((tc) => ({
      id: tc.id,
      call: tc.call,
      expected: tc.expected,
    })),
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => code.split('\n'), [code])
  const highlightedCode = useMemo(() => highlightPythonDark(code), [code])

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

  // Handle Reset
  const handleReset = () => {
    setCode(challenge.initialCode)
    setTestResults({
      status: 'idle',
      cases: challenge.testCases.map((tc) => ({
        id: tc.id,
        call: tc.call,
        expected: tc.expected,
      })),
    })
  }

  // Simulate Run code
  const handleRunCode = () => {
    setIsRunning(true)
    setTimeout(() => {
      setIsRunning(false)
      const hasCorrectLogic =
        (code.includes('* 2') || code.includes('2 *') || code.includes('+ number')) &&
        code.includes('return')

      if (hasCorrectLogic) {
        setTestResults({
          status: 'success',
          cases: challenge.testCases.map((tc) => ({
            id: tc.id,
            call: tc.call,
            expected: tc.expected,
            actual: tc.expected,
            passed: true,
          })),
        })
      } else {
        const isPass = code.includes('pass')
        setTestResults({
          status: 'fail',
          cases: challenge.testCases.map((tc) => ({
            id: tc.id,
            call: tc.call,
            expected: tc.expected,
            actual: isPass ? 'None' : '0',
            passed: false,
          })),
        })
      }
    }, 500)
  }

  // Simulate Check solution
  const handleCheckSolution = () => {
    setIsChecking(true)
    setTimeout(() => {
      setIsChecking(false)
      const hasCorrectLogic =
        (code.includes('* 2') || code.includes('2 *') || code.includes('+ number')) &&
        code.includes('return')

      if (hasCorrectLogic) {
        setTestResults({
          status: 'success',
          cases: challenge.testCases.map((tc) => ({
            id: tc.id,
            call: tc.call,
            expected: tc.expected,
            actual: tc.expected,
            passed: true,
          })),
        })
      } else {
        const isPass = code.includes('pass')
        setTestResults({
          status: 'fail',
          cases: challenge.testCases.map((tc) => ({
            id: tc.id,
            call: tc.call,
            expected: tc.expected,
            actual: isPass ? 'None' : '0',
            passed: false,
          })),
        })
      }
    }, 700)
  }

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

      {/* Test Cases Table */}
      <div className="embedded-challenge__testcases">
        <div className="embedded-challenge__testcases-header">
          <span className="embedded-challenge__testcases-title">Test cases</span>
          <span
            className={`embedded-challenge__overall-status ${
              testResults.status === 'success'
                ? 'embedded-challenge__overall-status--passed'
                : testResults.status === 'fail'
                ? 'embedded-challenge__overall-status--failed'
                : ''
            }`}
          >
            {testResults.status === 'idle'
              ? 'Not run yet'
              : testResults.status === 'running' || isChecking
              ? 'Evaluating...'
              : testResults.status === 'success'
              ? 'All 2 test cases passed ✓'
              : 'Test cases failed'}
          </span>
        </div>

        <div className="embedded-challenge__cases-list">
          {testResults.cases.map((tc) => (
            <div key={tc.id} className="embedded-challenge__case-row">
              <span className="embedded-challenge__case-call">{tc.call}</span>
              <span className="embedded-challenge__case-expected">
                Expected: {tc.expected}
                {tc.actual !== undefined && tc.actual !== tc.expected && (
                  <span className="embedded-challenge__case-actual"> (Got: {tc.actual})</span>
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
                {tc.passed === true
                  ? 'Passed ✓'
                  : tc.passed === false
                  ? 'Failed ✗'
                  : 'Not run'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="embedded-challenge__actions">
        <div className="embedded-challenge__actions-left">
          <button
            type="button"
            className="embedded-challenge__btn-run"
            onClick={handleRunCode}
            disabled={isRunning || isChecking}
          >
            {isRunning ? 'Running...' : 'Run code'}
          </button>
          <button
            type="button"
            className="embedded-challenge__btn-submit"
            onClick={handleCheckSolution}
            disabled={isRunning || isChecking}
          >
            {isChecking ? 'Checking...' : 'Check solution'}
          </button>
          <button
            type="button"
            className="embedded-challenge__btn-reset"
            onClick={handleReset}
            disabled={isRunning || isChecking}
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
