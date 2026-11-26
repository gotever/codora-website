import { useEffect } from 'react'
import type { AssessmentQuestion } from '../../../lib/api'
import { isQuestionAnswered } from './assessmentUtils'

interface AssessmentSubmitModalProps {
  open: boolean
  questions: AssessmentQuestion[]
  answers: Record<string, string>
  flaggedIds: Set<string>
  busy: boolean
  onSelectQuestion: (index: number) => void
  onClose: () => void
  onConfirmSubmit: () => void
}

export default function AssessmentSubmitModal({
  open,
  questions,
  answers,
  flaggedIds,
  busy,
  onSelectQuestion,
  onClose,
  onConfirmSubmit,
}: AssessmentSubmitModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, busy, onClose])

  if (!open) return null

  const unansweredIndices = questions
    .map((q, idx) => (!isQuestionAnswered(q, answers) ? idx + 1 : null))
    .filter((n): n is number => n !== null)

  const answeredCount = questions.length - unansweredIndices.length
  const flaggedCount = questions.filter((q) => flaggedIds.has(q.id)).length
  const canSubmit = unansweredIndices.length === 0 && !busy

  const mcqQuestions = questions.map((q, index) => ({ q, index })).slice(0, 7)
  const codingQuestions = questions.map((q, index) => ({ q, index })).slice(7)

  const renderTile = (q: AssessmentQuestion, index: number) => {
    const answered = isQuestionAnswered(q, answers)
    const flagged = flaggedIds.has(q.id)

    return (
      <button
        key={q.id}
        type="button"
        className={`exam-review-tile ${answered ? 'exam-review-tile--answered' : 'exam-review-tile--missing'} ${
          flagged ? 'exam-review-tile--flagged' : ''
        }`}
        onClick={() => {
          onSelectQuestion(index)
          onClose()
        }}
        disabled={busy}
      >
        <span className="exam-review-tile__num">Q{index + 1}</span>
        <span className="exam-review-tile__state">
          {answered ? 'Answered' : 'Unanswered'}
        </span>
        {flagged && (
          <span className="exam-review-tile__flag" aria-label="Flagged">
            Flagged
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="exam-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="exam-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
      >
        <div className="exam-modal__header">
          <div>
            <h2 id="submit-modal-title">Review &amp; Submit Assessment</h2>
            <p>Check your completion status or jump to any question before finalizing your submission.</p>
          </div>
          <button
            type="button"
            className="exam-modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close review dialog"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="exam-modal__summary">
          <div className="exam-modal__stat">
            <span>Answered</span>
            <strong>{answeredCount} / {questions.length}</strong>
          </div>
          <div className="exam-modal__stat">
            <span>Unanswered</span>
            <strong className={unansweredIndices.length > 0 ? 'exam-modal__stat--warn' : ''}>
              {unansweredIndices.length}
            </strong>
          </div>
          <div className="exam-modal__stat">
            <span>Flagged</span>
            <strong>{flaggedCount}</strong>
          </div>
        </div>

        <div className="exam-modal__groups">
          <div className="exam-modal__group">
            <h3>Part 1 · Multiple Choice (1–7)</h3>
            <div className="exam-review-grid">
              {mcqQuestions.map(({ q, index }) => renderTile(q, index))}
            </div>
          </div>

          <div className="exam-modal__group">
            <h3>Part 2 · Python Coding (8–10)</h3>
            <div className="exam-review-grid">
              {codingQuestions.map(({ q, index }) => renderTile(q, index))}
            </div>
          </div>
        </div>

        {unansweredIndices.length > 0 && (
          <div className="exam-modal__alert exam-modal__alert--error" role="alert">
            Complete all 10 questions before submitting. Missing:{' '}
            <strong>{unansweredIndices.map((n) => `Q${n}`).join(', ')}</strong>.
            {' '}For coding questions, make sure you have edited or written your solution in the code editor.
          </div>
        )}

        {unansweredIndices.length === 0 && flaggedCount > 0 && (
          <div className="exam-modal__alert exam-modal__alert--warn">
            You still have {flaggedCount} flagged {flaggedCount === 1 ? 'question' : 'questions'}. Click any tile above to double-check before submitting.
          </div>
        )}

        <div className="exam-modal__footer">
          <button
            type="button"
            className="exam-btn exam-btn--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Back to exam
          </button>
          <button
            type="button"
            className="exam-btn exam-btn--primary"
            onClick={onConfirmSubmit}
            disabled={!canSubmit}
          >
            {busy ? 'Grading submission…' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
