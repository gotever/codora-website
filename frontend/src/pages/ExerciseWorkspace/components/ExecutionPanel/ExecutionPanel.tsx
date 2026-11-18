import { useState } from 'react'
import type { TestCase } from '../../../../data/exercises'
import './ExecutionPanel.css'

interface ExecutionPanelProps {
  testCases: TestCase[]
  activeTab: 'testcases' | 'output'
  onActiveTabChange: (tab: 'testcases' | 'output') => void
  isRunning: boolean
  isSubmitting: boolean
  runResult: {
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
  pyodideLoading?: boolean
}

function getInputFields(inputLabel: string, input: string, structuredInputs?: { label: string; value: string }[]) {
  if (structuredInputs?.length) return structuredInputs

  const labels = inputLabel.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const labelNames = labels.map((line) => line.match(/^([\w]+)\s*=/)?.[1]).filter((name): name is string => Boolean(name))
  const lines = input.split(/\r?\n/)
  const assignments: { label: string; value: string }[] = []
  const preamble: string[] = []
  let active: { label: string; value: string } | null = null

  for (const line of lines) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/)
    if (match) {
      active = { label: `${match[1]} =`, value: match[2] }
      assignments.push(active)
    } else if (active) {
      active.value = active.value ? `${active.value}\n${line}` : line
    } else if (line.trim()) {
      preamble.push(line)
    }
  }

  if (labelNames.length > 1) {
    const matched = labelNames.map((name) => assignments.find((field) => field.label.startsWith(`${name} `)))
    if (matched.every(Boolean)) return matched as { label: string; value: string }[]
    if (lines.length === labelNames.length) return labels.map((label, index) => ({ label, value: lines[index] }))
  }

  if (assignments.length) {
    return [
      ...(preamble.length ? [{ label: labels[0] ?? 'Input', value: preamble.join('\n') }] : []),
      ...assignments,
    ]
  }

  return [{ label: inputLabel || 'Input', value: input }]
}

function InputFields({ fields, onCopy, copiedIndex }: {
  fields: { label: string; value: string }[]
  onCopy: (value: string, index: number) => void
  copiedIndex: number | null
}) {
  return (
    <div className="exec-panel__input-fields">
      {fields.map((field, index) => (
        <div className="exec-panel__sample-field" key={`${field.label}-${index}`}>
          <span>{field.label}</span>
          <pre>{field.value}</pre>
          <button type="button" className="exec-panel__copy-input" onClick={() => onCopy(field.value, index)} aria-label={`Copy ${field.label}`} title="Copy input">
            {copiedIndex === index ? '✓' : (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}

export default function ExecutionPanel({
  testCases,
  activeTab,
  onActiveTabChange,
  isRunning,
  isSubmitting,
  runResult,
  pyodideLoading = false,
}: ExecutionPanelProps) {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0)
  const [copiedInputIndex, setCopiedInputIndex] = useState<number | null>(null)

  const activeCaseIdx = Math.min(selectedCaseIdx, Math.max(0, testCases.length - 1))
  const currentCase = testCases[activeCaseIdx] || testCases[0]
  const currentCaseResult = runResult.results?.find((r) => r.caseId === currentCase?.id)

  const currentInputFields = currentCase
    ? getInputFields(
        currentCaseResult?.inputLabel ?? currentCase.inputLabel,
        currentCaseResult?.input ?? currentCase.input,
        currentCaseResult?.inputs ?? currentCase.inputs,
      )
    : []

  const copyInput = async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedInputIndex(index)
      window.setTimeout(() => setCopiedInputIndex(null), 1400)
    } catch {
      setCopiedInputIndex(null)
    }
  }

  const renderCasePicker = (showAddCase = false) => (
    <div className="exec-panel__output-case-row">
      <div className="exec-panel__case-pills" role="group" aria-label="Choose test case">
        {testCases.map((testCase, index) => {
          const result = runResult.results?.find((item) => item.caseId === testCase.id)
          return (
            <button
              key={testCase.id}
              type="button"
              aria-pressed={activeCaseIdx === index}
              className={`exec-panel__case-pill ${activeCaseIdx === index ? 'exec-panel__case-pill--active' : ''} ${result ? result.passed ? 'exec-panel__case-pill--passed' : 'exec-panel__case-pill--failed' : ''}`}
              onClick={() => setSelectedCaseIdx(index)}
            >
              {testCase.label}
              {result && <span className="exec-panel__pill-status-icon">{result.passed ? '✓' : '×'}</span>}
            </button>
          )
        })}
        {showAddCase && <button type="button" className="exec-panel__add-case-btn" title="Add custom test case" aria-label="Add custom test case">+</button>}
      </div>
    </div>
  )

  const renderSelectedCaseContent = (includeOutput: boolean) => currentCase && (
    <div className="exec-panel__sample-content">
      <div className="exec-panel__sample-section">
        <span className="exec-panel__sample-label">Input</span>
        <InputFields fields={currentInputFields} onCopy={copyInput} copiedIndex={copiedInputIndex} />
      </div>
      {includeOutput && (
        <div className="exec-panel__sample-section">
          <span className="exec-panel__sample-label">Output</span>
          <div className="exec-panel__sample-field exec-panel__sample-field--output">
            <pre>{currentCaseResult ? currentCaseResult.actualOutput || '(empty output)' : 'Not run yet'}</pre>
          </div>
          {currentCaseResult?.error && <pre className="exec-panel__error-detail">{currentCaseResult.error}</pre>}
        </div>
      )}
      <div className="exec-panel__sample-section">
        <span className="exec-panel__sample-label">Expected</span>
        <div className="exec-panel__sample-field exec-panel__sample-field--output"><pre>{currentCaseResult?.expectedOutput ?? currentCase.expectedOutput ?? '(empty output)'}</pre></div>
      </div>
    </div>
  )

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
          onClick={() => onActiveTabChange('testcases')}
        >
          Test cases
        </button>
        <button
          type="button"
          className={`exec-panel__tab ${activeTab === 'output' ? 'exec-panel__tab--active' : ''}`}
          onClick={() => onActiveTabChange('output')}
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
            {renderCasePicker(true)}
            {renderSelectedCaseContent(true)}
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
              <div className="exec-panel__result-view" aria-live="polite">
                <div className={`exec-panel__verdict ${runResult.status === 'success' ? 'exec-panel__verdict--accepted' : 'exec-panel__verdict--failed'}`}>
                  <div className="exec-panel__verdict-main">
                    <strong>{runResult.summary?.label ?? (runResult.status === 'success' ? 'Accepted' : 'Execution failed')}</strong>
                  </div>
                  <div className="exec-panel__result-metrics">
                    {runResult.summary?.runtimeMs !== undefined && (
                      <div><span>Runtime:</span><strong>{runResult.summary.runtimeMs} ms</strong></div>
                    )}
                  </div>
                </div>

                {runResult.summary?.failedCase && (runResult.summary.failedCase.hidden || !runResult.results?.length) && (
                  <section className="exec-panel__failed-case" aria-label="Failed test case details">
                    <div className="exec-panel__section-heading">
                      <strong>{runResult.summary.failedCase.hidden ? 'Hidden test case failed' : `${runResult.summary.failedCase.label ?? 'Failed test case'} failed`}</strong>
                      <span>First failing case</span>
                    </div>
                    {runResult.summary.failedCase.hidden ? (
                      <p className="exec-panel__hidden-case-note">The failing test is hidden. Review your edge cases and constraints.</p>
                    ) : (
                      <div className="exec-panel__comparison-grid">
                        {runResult.summary.failedCase.expected !== undefined && (
                          <div className="exec-panel__comparison-item">
                            <span>Expected</span>
                            <pre>{runResult.summary.failedCase.expected || '(empty output)'}</pre>
                          </div>
                        )}
                        {runResult.summary.failedCase.actual !== undefined && (
                          <div className="exec-panel__comparison-item exec-panel__comparison-item--actual">
                            <span>Your output</span>
                            <pre>{runResult.summary.failedCase.actual || '(empty output)'}</pre>
                          </div>
                        )}
                      </div>
                    )}
                    {runResult.summary.failedCase.error && <pre className="exec-panel__error-detail">{runResult.summary.failedCase.error}</pre>}
                  </section>
                )}

                {testCases.length > 0 && (
                  <section className="exec-panel__selected-test" aria-label="Test case details">
                    {renderCasePicker()}
                    {renderSelectedCaseContent(true)}
                  </section>
                )}

                {runResult.operation === 'run' && runResult.stdout && (
                  <details className="exec-panel__raw-output">
                    <summary>Raw run log</summary>
                    <pre>{runResult.stdout}</pre>
                  </details>
                )}

                {!runResult.summary && runResult.message && <pre className="exec-panel__error-detail">{runResult.message}</pre>}
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  )
}
