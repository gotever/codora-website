import { useState } from 'react'
import type { TestCase } from '../../../../data/exercises'
import './ExecutionPanel.css'

interface ExecutionPanelProps {
  testCases: TestCase[]
  onRun: () => void
  onSubmit: () => void
  isRunning: boolean
  isSubmitting: boolean
  runResult: {
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
  }
  pyodideReady?: boolean
  pyodideLoading?: boolean
}

export default function ExecutionPanel({
  testCases,
  onRun,
  onSubmit,
  isRunning,
  isSubmitting,
  runResult,
  pyodideReady = false,
  pyodideLoading = false,
}: ExecutionPanelProps) {
  const [activeTab, setActiveTab] = useState<'testcases' | 'output'>('testcases')
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0)

  const currentCase = testCases[selectedCaseIdx] || testCases[0]
  const currentCaseResult = runResult.results?.find((r) => r.caseId === currentCase?.id)

  const isCasePassed = currentCaseResult?.passed

  const buttonsDisabled = isRunning || isSubmitting || !pyodideReady

  return (
    <div className="exec-panel">
      {/* Console Top Header */}
      <div className="exec-panel__header">
        <div className="exec-panel__title">
          <span className="exec-panel__console-prompt">&gt;_</span>
          <span>Console</span>
        </div>
        <div className="exec-panel__status-pill">
          <span
            className={`exec-panel__status-dot ${
              isRunning || isSubmitting
                ? 'exec-panel__status-dot--running'
                : runResult.status === 'success'
                ? 'exec-panel__status-dot--success'
                : runResult.status === 'error'
                ? 'exec-panel__status-dot--error'
                : pyodideLoading
                ? 'exec-panel__status-dot--running'
                : 'exec-panel__status-dot--ready'
            }`}
          />
          <span className="exec-panel__status-text">
            {isRunning
              ? 'Running…'
              : isSubmitting
              ? 'Evaluating…'
              : pyodideLoading
              ? 'Loading Python…'
              : runResult.status === 'success'
              ? 'Passed'
              : runResult.status === 'error'
              ? 'Failed'
              : 'Ready'}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            width="12"
            height="12"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Tabs: Test cases | Output */}
      <div className="exec-panel__tabs">
        <button
          type="button"
          className={`exec-panel__tab ${activeTab === 'testcases' ? 'exec-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('testcases')}
        >
          Test cases
        </button>
        <button
          type="button"
          className={`exec-panel__tab ${activeTab === 'output' ? 'exec-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('output')}
        >
          Output
          {runResult.status !== 'idle' && (
            <span
              className={`exec-panel__tab-badge ${
                runResult.status === 'success' ? 'exec-panel__tab-badge--success' : 'exec-panel__tab-badge--error'
              }`}
            />
          )}
        </button>
      </div>

      {/* Body Area */}
      <div className="exec-panel__body">
        {activeTab === 'testcases' ? (
          <div className="exec-panel__cases-content">
            {/* Case selector pills */}
            <div className="exec-panel__case-selector">
              <div className="exec-panel__case-pills">
                {testCases.map((tc, idx) => {
                  const caseRes = runResult.results?.find((r) => r.caseId === tc.id)
                  return (
                    <button
                      key={tc.id}
                      type="button"
                      className={`exec-panel__case-pill ${
                        selectedCaseIdx === idx ? 'exec-panel__case-pill--active' : ''
                      } ${
                        caseRes
                          ? caseRes.passed
                            ? 'exec-panel__case-pill--passed'
                            : 'exec-panel__case-pill--failed'
                          : ''
                      }`}
                      onClick={() => setSelectedCaseIdx(idx)}
                    >
                      {tc.label}
                      {caseRes && (
                        <span className="exec-panel__pill-status-icon">
                          {caseRes.passed ? '✓' : '✗'}
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="exec-panel__add-case-btn"
                  title="Add custom test case"
                  aria-label="Add custom test case"
                >
                  +
                </button>
              </div>

              {/* Status on right */}
              <div className="exec-panel__case-summary">
                {runResult.status === 'idle' && <span>Not run yet</span>}
                {runResult.status === 'running' && <span>Testing…</span>}
                {runResult.status === 'success' && (
                  <span className="exec-panel__success-text">All cases passed</span>
                )}
                {runResult.status === 'error' && (
                  <span className="exec-panel__error-text">Check test results</span>
                )}
              </div>
            </div>

            {/* Test Case Details */}
            {currentCase && (
              <div className="exec-panel__case-details">
                <div className="exec-panel__field">
                  <span className="exec-panel__field-label">{currentCase.inputLabel}</span>
                  <div className="exec-panel__field-box">{currentCase.input}</div>
                </div>

                <div className="exec-panel__field-expected">
                  <span className="exec-panel__expected-label">Expected output</span>
                  <span className="exec-panel__expected-value">{currentCase.expectedOutput}</span>
                </div>

                {currentCaseResult && (
                  <div
                    className={`exec-panel__result-box ${
                      isCasePassed
                        ? 'exec-panel__result-box--passed'
                        : 'exec-panel__result-box--failed'
                    }`}
                  >
                    <div className="exec-panel__result-header">
                      <span>{isCasePassed ? '✓ Passed' : '✗ Output mismatch'}</span>
                      {currentCaseResult.executionTime !== undefined && (
                        <span className="exec-panel__result-time">{currentCaseResult.executionTime}ms</span>
                      )}
                    </div>
                    <div className="exec-panel__result-actual">
                      <span>Your output:</span>
                      <code>{currentCaseResult.actualOutput}</code>
                    </div>
                    {currentCaseResult.error && (
                      <div className="exec-panel__result-error">
                        <code>{currentCaseResult.error}</code>
                      </div>
                    )}
                  </div>
                )}

                <p className="exec-panel__hint-text">
                  {pyodideReady
                    ? 'Run your code to see the result. Submit to check all test cases.'
                    : 'Waiting for Python runtime to load…'}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Output Terminal Tab */
          <div className="exec-panel__terminal">
            {runResult.status === 'idle' ? (
              <p className="exec-panel__terminal-muted">
                No output yet. Click <strong>Run</strong> to test your code.
              </p>
            ) : runResult.status === 'running' ? (
              <div className="exec-panel__terminal-running">
                <span className="exec-panel__spinner" />
                <span>Executing Python code via Pyodide (WebAssembly)…</span>
              </div>
            ) : (
              <pre className="exec-panel__terminal-pre">
                <code>
                  {`Python 3.12 (Pyodide — in-browser WebAssembly)
[sandbox: client-side execution]
====================================
${runResult.stdout || ''}

${runResult.message || 'Execution finished.'}
`}
                </code>
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Action Footer Bar with Run & Submit */}
      <div className="exec-panel__footer">
        <button
          type="button"
          className="exec-panel__btn-run"
          onClick={onRun}
          disabled={buttonsDisabled}
          title={!pyodideReady ? 'Waiting for Python runtime…' : 'Run code'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>{isRunning ? 'Running…' : !pyodideReady ? 'Loading…' : 'Run'}</span>
        </button>

        <button
          type="button"
          className="exec-panel__btn-submit"
          onClick={onSubmit}
          disabled={buttonsDisabled}
          title={!pyodideReady ? 'Waiting for Python runtime…' : 'Submit code'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span>{isSubmitting ? 'Submitting…' : 'Submit'}</span>
        </button>
      </div>
    </div>
  )
}
