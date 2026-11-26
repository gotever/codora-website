import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Assessment, AssessmentQuestion } from '../../../lib/api'
import WorkspaceCodeEditor from '../../ExerciseWorkspace/components/WorkspaceCodeEditor/WorkspaceCodeEditor'
import AssessmentSubmitModal from './AssessmentSubmitModal'
import PromptRenderer, { InlineText } from './PromptRenderer'
import {
  formatConceptLabel,
  formatElapsed,
  isQuestionAnswered,
  KIND_LABELS,
  OPTION_LETTERS,
} from './assessmentUtils'

interface AssessmentExamProps {
  assessment: Assessment
  userId: string
  answers: Record<string, string>
  saveState: string
  busy: boolean
  error: string
  onAnswerChange: (questionId: string, value: string) => void
  onSaveDraft: () => void
  onSubmit: () => Promise<void>
  onReload: () => void
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export default function AssessmentExam({
  assessment,
  userId,
  answers,
  saveState,
  busy,
  error,
  onAnswerChange,
  onSaveDraft,
  onSubmit,
  onReload,
}: AssessmentExamProps) {
  const questions = assessment.questions
  const [currentIndex, setCurrentIndex] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const flagStorageKey = `codora-assessment-flags:${userId}:${assessment.id}`
  const timerStorageKey = `codora-assessment-timer:${userId}:${assessment.id}`

  const [flaggedList, setFlaggedList] = useState<string[]>(() =>
    readJsonStorage<string[]>(flagStorageKey, []),
  )
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    readJsonStorage<{ seconds?: number }>(timerStorageKey, {}).seconds ?? 0,
  )
  const [showTimer, setShowTimer] = useState<boolean>(() =>
    readJsonStorage<{ visible?: boolean }>(timerStorageKey, {}).visible ?? true,
  )

  const stageScrollRef = useRef<HTMLDivElement>(null)
  const codingPromptScrollRef = useRef<HTMLDivElement>(null)

  const flaggedIds = useMemo(() => new Set(flaggedList), [flaggedList])
  const currentQuestion = questions[currentIndex]
  const answeredCount = useMemo(
    () => questions.filter((q) => isQuestionAnswered(q, answers)).length,
    [questions, answers],
  )

  // Reset stage scroll to the top whenever switching questions.
  useEffect(() => {
    if (stageScrollRef.current) stageScrollRef.current.scrollTop = 0
    if (codingPromptScrollRef.current) codingPromptScrollRef.current.scrollTop = 0
  }, [currentIndex])

  // Optional calm elapsed timer (no limit, no auto-submit).
  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        timerStorageKey,
        JSON.stringify({ seconds: elapsedSeconds, visible: showTimer }),
      )
    } catch {
      // Ignore unavailable storage.
    }
  }, [elapsedSeconds, showTimer, timerStorageKey])

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlaggedList((prev) => {
        const next = prev.includes(questionId)
          ? prev.filter((item) => item !== questionId)
          : [...prev, questionId]
        try {
          sessionStorage.setItem(flagStorageKey, JSON.stringify(next))
        } catch {
          // Ignore unavailable storage.
        }
        return next
      })
    },
    [flagStorageKey],
  )

  const goToQuestion = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, index))
      setCurrentIndex(clamped)
      setDrawerOpen(false)
    },
    [questions.length],
  )

  // Keyboard navigation & quick option selection when not typing in an input or Monaco editor.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (reviewOpen || busy) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.monaco-editor')
        ) {
          return
        }
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault()
        goToQuestion(currentIndex - 1)
      } else if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        e.preventDefault()
        goToQuestion(currentIndex + 1)
      } else if (e.key.toLowerCase() === 'f' && currentQuestion) {
        e.preventDefault()
        toggleFlag(currentQuestion.id)
      } else if (
        currentQuestion &&
        currentQuestion.kind !== 'coding' &&
        ['1', '2', '3', '4'].includes(e.key)
      ) {
        const option = currentQuestion.options[Number(e.key) - 1]
        if (option) {
          e.preventDefault()
          onAnswerChange(currentQuestion.id, option.id)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reviewOpen, busy, currentIndex, questions.length, currentQuestion, goToQuestion, toggleFlag, onAnswerChange])

  if (!currentQuestion) return null

  const isCoding = currentQuestion.kind === 'coding'
  const isFlagged = flaggedIds.has(currentQuestion.id)
  const isAnswered = isQuestionAnswered(currentQuestion, answers)
  const mcqQuestions = questions.slice(0, 7)
  const codingQuestions = questions.slice(7)

  const handleResetCoding = (q: AssessmentQuestion) => {
    if (!answers[q.id]?.trim()) return
    onAnswerChange(q.id, '')
  }

  const renderPaletteButton = (q: AssessmentQuestion, index: number) => {
    const active = index === currentIndex
    const done = isQuestionAnswered(q, answers)
    const flagged = flaggedIds.has(q.id)

    return (
      <button
        key={q.id}
        type="button"
        onClick={() => goToQuestion(index)}
        aria-current={active ? 'step' : undefined}
        aria-label={`Question ${index + 1}, ${done ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}`}
        className={[
          'exam-nav-tile',
          active ? 'exam-nav-tile--current' : '',
          done ? 'exam-nav-tile--answered' : '',
          flagged ? 'exam-nav-tile--flagged' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span>{index + 1}</span>
        {done && !active && <span className="exam-nav-tile__dot" aria-hidden="true" />}
        {flagged && <span className="exam-nav-tile__flag" aria-hidden="true" />}
      </button>
    )
  }

  const saveToneClass = saveState.includes('not saved')
    ? 'exam-save-badge--error'
    : saveState.includes('Saving') || saveState.includes('Unsaved')
    ? 'exam-save-badge--pending'
    : 'exam-save-badge--saved'

  return (
    <div className="exam-shell">
      {/* Top Exam Bar */}
      <header className="exam-topbar">
        <div className="exam-topbar__left">
          <Link to="/assessments" className="exam-topbar__exit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Exit</span>
          </Link>
          <button
            type="button"
            className="exam-topbar__drawer-btn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            aria-controls="exam-question-navigator"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Q{currentIndex + 1}/10</span>
          </button>
          <div className="exam-topbar__brand">
            <span className="exam-topbar__title">Python Fundamentals Assessment</span>
          </div>
        </div>

        <div className="exam-topbar__center">
          <span className="exam-topbar__progress">
            <strong>{answeredCount}</strong> / {questions.length} answered
          </span>
          <div className="exam-timer" aria-label="Elapsed time">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            {showTimer && <span className="exam-timer__value">{formatElapsed(elapsedSeconds)}</span>}
            <button
              type="button"
              className="exam-timer__toggle"
              onClick={() => setShowTimer((v) => !v)}
              aria-label={showTimer ? 'Hide elapsed clock' : 'Show elapsed clock'}
            >
              {showTimer ? 'Hide' : 'Show time'}
            </button>
          </div>
        </div>

        <div className="exam-topbar__right">
          <span className={`exam-save-badge ${saveToneClass}`} role="status">
            <span className="exam-save-badge__dot" aria-hidden="true" />
            <span>{busy ? 'Processing…' : saveState || 'Draft saved'}</span>
          </span>
          <button
            type="button"
            className="exam-btn exam-btn--primary"
            onClick={() => setReviewOpen(true)}
            disabled={busy}
          >
            Review &amp; Submit
          </button>
        </div>
      </header>

      {error && (
        <div className="exam-banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="exam-btn exam-btn--ghost exam-btn--sm" onClick={onReload}>
            Reload
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="exam-body">
        {drawerOpen && (
          <div
            className="exam-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Left Question Navigator Rail */}
        <aside
          id="exam-question-navigator"
          className={`exam-sidebar ${drawerOpen ? 'exam-sidebar--open' : ''}`}
          aria-label="Question navigator"
        >
          <div className="exam-sidebar__section">
            <h2 className="exam-sidebar__heading">Part 1 · Multiple Choice</h2>
            <div className="exam-nav-grid">
              {mcqQuestions.map((q, idx) => renderPaletteButton(q, idx))}
            </div>
          </div>

          <div className="exam-sidebar__section">
            <h2 className="exam-sidebar__heading">Part 2 · Python Coding</h2>
            <div className="exam-nav-grid">
              {codingQuestions.map((q, idx) => renderPaletteButton(q, idx + 7))}
            </div>
          </div>

          <div className="exam-sidebar__legend">
            <div className="exam-legend-item">
              <span className="exam-legend-swatch exam-legend-swatch--current" />
              <span>Current</span>
            </div>
            <div className="exam-legend-item">
              <span className="exam-legend-swatch exam-legend-swatch--answered" />
              <span>Answered</span>
            </div>
            <div className="exam-legend-item">
              <span className="exam-legend-swatch exam-legend-swatch--flagged" />
              <span>Flagged</span>
            </div>
            <div className="exam-legend-item">
              <span className="exam-legend-swatch" />
              <span>Unanswered</span>
            </div>
          </div>

          <button
            type="button"
            className="exam-btn exam-btn--secondary exam-sidebar__review-btn"
            onClick={() => {
              setDrawerOpen(false)
              setReviewOpen(true)
            }}
          >
            Open review summary
          </button>
        </aside>

        {/* Active Question Stage */}
        <main className="exam-stage" id="main-content">
          {!isCoding ? (
            <div className="exam-stage__scroll" ref={stageScrollRef}>
              <article className="exam-mcq-card" aria-labelledby={`${currentQuestion.id}-title`}>
                <div className="exam-q-header">
                  <div className="exam-q-meta">
                    <span className="exam-q-number">Question {currentIndex + 1} of {questions.length}</span>
                    <span className="exam-pill exam-pill--kind">{KIND_LABELS[currentQuestion.kind]}</span>
                    <span className="exam-pill exam-pill--concept">
                      {formatConceptLabel(currentQuestion.concept_id)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`exam-flag-btn ${isFlagged ? 'exam-flag-btn--active' : ''}`}
                    onClick={() => toggleFlag(currentQuestion.id)}
                    aria-pressed={isFlagged}
                  >
                    <svg viewBox="0 0 24 24" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    <span>{isFlagged ? 'Flagged' : 'Flag for review'}</span>
                  </button>
                </div>

                <h1 id={`${currentQuestion.id}-title`} className="assessment-sr">
                  Question {currentIndex + 1}: {KIND_LABELS[currentQuestion.kind]}
                </h1>

                <PromptRenderer prompt={currentQuestion.prompt} />

                <fieldset className="exam-options-fieldset" disabled={busy}>
                  <legend className="assessment-sr">
                    Choose an answer for question {currentIndex + 1}
                  </legend>
                  {currentQuestion.options.map((option, optIdx) => {
                    const selected = answers[currentQuestion.id] === option.id
                    return (
                      <label
                        key={option.id}
                        className={`exam-option-card ${selected ? 'exam-option-card--selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          checked={selected}
                          onChange={() => onAnswerChange(currentQuestion.id, option.id)}
                        />
                        <span className="exam-option-card__letter" aria-hidden="true">
                          {OPTION_LETTERS[optIdx] ?? optIdx + 1}
                        </span>
                        <span className="exam-option-card__text">
                          <InlineText text={option.text} />
                        </span>
                        <span className="exam-option-card__check" aria-hidden="true">
                          {selected && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </fieldset>
              </article>
            </div>
          ) : (
            <div className="exam-coding-split">
              <section className="exam-coding-split__left" ref={codingPromptScrollRef} aria-labelledby={`${currentQuestion.id}-title`}>
                <div className="exam-q-header">
                  <div className="exam-q-meta">
                    <span className="exam-q-number">Question {currentIndex + 1} of {questions.length}</span>
                    <span className="exam-pill exam-pill--kind">{KIND_LABELS[currentQuestion.kind]}</span>
                    <span className="exam-pill exam-pill--concept">
                      {formatConceptLabel(currentQuestion.concept_id)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`exam-flag-btn ${isFlagged ? 'exam-flag-btn--active' : ''}`}
                    onClick={() => toggleFlag(currentQuestion.id)}
                    aria-pressed={isFlagged}
                  >
                    <svg viewBox="0 0 24 24" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
                  </button>
                </div>

                <h1 id={`${currentQuestion.id}-title`} className="assessment-sr">
                  Question {currentIndex + 1}: Python Coding
                </h1>

                {currentQuestion.function_name && (
                  <div className="exam-coding-signature">
                    <span>Function:</span>
                    <code>{currentQuestion.function_name}</code>
                  </div>
                )}

                <PromptRenderer prompt={currentQuestion.prompt} />
              </section>

              <section className="exam-coding-split__right" aria-label="Code editor">
                <div className="exam-coding-split__editor">
                  <WorkspaceCodeEditor
                    key={currentQuestion.id}
                    value={answers[currentQuestion.id] ?? currentQuestion.starter_code ?? ''}
                    onChange={(v) => onAnswerChange(currentQuestion.id, v)}
                    filename={`${currentQuestion.function_name || 'solution'}.py`}
                    onReset={() => handleResetCoding(currentQuestion)}
                    readOnly={busy}
                    autoFocus={false}
                    fillHeight
                    statusLabel={
                      isAnswered
                        ? saveState || 'Edited · ready'
                        : 'Not edited yet — edit code to record answer'
                    }
                  />
                </div>

                <p className="exam-coding-note">
                  No local execution during the exam — your function is graded on the server against hidden test cases upon submission.
                </p>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Exam Footer */}
      <footer className="exam-footer">
        <div className="exam-footer__left">
          <button
            type="button"
            className="exam-btn exam-btn--secondary"
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          <button
            type="button"
            className={`exam-btn exam-btn--ghost ${isFlagged ? 'exam-btn--flagged' : ''}`}
            onClick={() => toggleFlag(currentQuestion.id)}
          >
            {isFlagged ? 'Unflag' : 'Flag'}
          </button>
        </div>

        <span className="exam-footer__shortcuts" aria-hidden="true">
          {isCoding
            ? '← / → switch question · F flag'
            : '1–4 select option · ← / → switch question · F flag'}
        </span>

        <div className="exam-footer__right">
          <button
            type="button"
            className="exam-btn exam-btn--secondary"
            onClick={onSaveDraft}
            disabled={busy}
          >
            Save draft
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              className="exam-btn exam-btn--primary"
              onClick={() => goToQuestion(currentIndex + 1)}
            >
              Next question →
            </button>
          ) : (
            <button
              type="button"
              className="exam-btn exam-btn--primary"
              onClick={() => setReviewOpen(true)}
              disabled={busy}
            >
              Review &amp; Submit →
            </button>
          )}
        </div>
      </footer>

      <AssessmentSubmitModal
        open={reviewOpen}
        questions={questions}
        answers={answers}
        flaggedIds={flaggedIds}
        busy={busy}
        onSelectQuestion={goToQuestion}
        onClose={() => setReviewOpen(false)}
        onConfirmSubmit={async () => {
          await onSubmit()
          setReviewOpen(false)
        }}
      />
    </div>
  )
}
