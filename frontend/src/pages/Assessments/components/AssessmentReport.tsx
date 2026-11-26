import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Assessment, AuthUser } from '../../../lib/api'
import WorkspaceCodeEditor from '../../ExerciseWorkspace/components/WorkspaceCodeEditor/WorkspaceCodeEditor'
import PromptRenderer, { InlineText } from './PromptRenderer'
import { formatConceptLabel, formatDate, KIND_LABELS, OPTION_LETTERS } from './assessmentUtils'

interface AssessmentReportProps {
  assessment: Assessment
  user: AuthUser
  busy: boolean
  onCreateNew: () => void
}

type ReviewFilter = 'all' | 'incorrect' | 'correct' | 'coding'

export default function AssessmentReport({
  assessment,
  user,
  busy,
  onCreateNew,
}: AssessmentReportProps) {
  const [filter, setFilter] = useState<ReviewFilter>('all')

  const questions = assessment.questions
  const results = useMemo(() => assessment.results ?? {}, [assessment.results])

  const stats = useMemo(() => {
    let mcqCorrect = 0
    let mcqTotal = 0
    let codingCorrect = 0
    let codingTotal = 0
    const byConcept = new Map<string, { correct: number; total: number }>()

    for (const q of questions) {
      const ok = Boolean(results[q.id]?.correct)
      if (q.kind === 'coding') {
        codingTotal++
        if (ok) codingCorrect++
      } else {
        mcqTotal++
        if (ok) mcqCorrect++
      }
      const entry = byConcept.get(q.concept_id) ?? { correct: 0, total: 0 }
      entry.total++
      if (ok) entry.correct++
      byConcept.set(q.concept_id, entry)
    }

    const totalCorrect = mcqCorrect + codingCorrect
    return {
      mcqCorrect,
      mcqTotal,
      codingCorrect,
      codingTotal,
      totalCorrect,
      incorrectCount: questions.length - totalCorrect,
      concepts: Array.from(byConcept.entries()).map(([id, value]) => ({ id, ...value })),
    }
  }, [questions, results])

  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, index) => ({ q, index, ok: Boolean(results[q.id]?.correct) }))
      .filter(({ q, ok }) => {
        if (filter === 'incorrect') return !ok
        if (filter === 'correct') return ok
        if (filter === 'coding') return q.kind === 'coding'
        return true
      })
  }, [questions, results, filter])

  const passed = assessment.status === 'passed'

  const scrollToQuestion = (id: string) => {
    setFilter('all')
    requestAnimationFrame(() => {
      document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="exam-report">
      <header className="exam-report__topbar">
        <div className="exam-report__topbar-inner">
          <Link to="/assessments" className="exam-topbar__exit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Tests &amp; history</span>
          </Link>
          <span className="exam-report__timestamp">
            Submitted {formatDate(assessment.submitted_at ?? assessment.created_at)}
          </span>
          <div className="exam-report__topbar-actions">
            <Link to="/profile" className="exam-btn exam-btn--ghost exam-btn--sm">
              Learner profile
            </Link>
            <button
              type="button"
              className="exam-btn exam-btn--primary exam-btn--sm"
              onClick={onCreateNew}
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Start new test'}
            </button>
          </div>
        </div>
      </header>

      <main className="exam-report__container" id="main-content">
        {/* Scorecard Summary */}
        <section className="exam-scorecard" aria-labelledby="scorecard-heading">
          <div className="exam-scorecard__main">
            <div className={`exam-scorecard__badge-box ${passed ? 'exam-scorecard__badge-box--passed' : 'exam-scorecard__badge-box--failed'}`}>
              <span className="exam-scorecard__score">{assessment.score ?? stats.totalCorrect}</span>
              <span className="exam-scorecard__denom">/ {questions.length}</span>
            </div>
            <div className="exam-scorecard__copy">
              <span className={`exam-status-pill ${passed ? 'exam-status-pill--passed' : 'exam-status-pill--failed'}`}>
                {passed ? 'Assessment passed' : 'Needs practice'}
              </span>
              <h1 id="scorecard-heading">
                {passed ? 'Great job — passing score achieved' : 'Keep practicing — review your explanations below'}
              </h1>
              <p>
                {user.level === 'intermediate'
                  ? 'Your learner level is Intermediate.'
                  : passed
                  ? 'Assessment requirement met (8/10). Master four concepts in exercises to complete your promotion to Intermediate.'
                  : 'You need at least 8/10 to pass. Review the concepts below, practice in exercises, and retake when ready.'}
              </p>
            </div>
          </div>

          <div className="exam-scorecard__metrics">
            <div className="exam-scorecard__metric">
              <span>Multiple Choice</span>
              <strong>{stats.mcqCorrect} / {stats.mcqTotal}</strong>
            </div>
            <div className="exam-scorecard__metric">
              <span>Python Coding</span>
              <strong>{stats.codingCorrect} / {stats.codingTotal}</strong>
            </div>
            <div className="exam-scorecard__metric">
              <span>Pass Threshold</span>
              <strong>{assessment.pass_score} / {questions.length}</strong>
            </div>
          </div>

          <div className="exam-concept-breakdown">
            <h2>Performance by concept</h2>
            <div className="exam-concept-chips">
              {stats.concepts.map((c) => {
                const allGood = c.correct === c.total
                return (
                  <div
                    key={c.id}
                    className={`exam-concept-chip ${allGood ? 'exam-concept-chip--ok' : 'exam-concept-chip--warn'}`}
                  >
                    <span className="exam-concept-chip__name">{formatConceptLabel(c.id)}</span>
                    <strong className="exam-concept-chip__score">
                      {c.correct}/{c.total}
                    </strong>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Jump Strip + Filter Toolbar */}
        <section className="exam-report__controls" aria-label="Question review controls">
          <div className="exam-report__jump-list">
            {questions.map((q, idx) => {
              const ok = Boolean(results[q.id]?.correct)
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => scrollToQuestion(q.id)}
                  className={`exam-report__jump-pill ${ok ? 'exam-report__jump-pill--ok' : 'exam-report__jump-pill--err'}`}
                  aria-label={`Jump to question ${idx + 1}, ${ok ? 'correct' : 'incorrect'}`}
                >
                  <span>Q{idx + 1}</span>
                </button>
              )
            })}
          </div>

          <div className="exam-report__filters" role="tablist" aria-label="Filter reviewed questions">
            {(
              [
                ['all', `All (${questions.length})`],
                ['incorrect', `Incorrect (${stats.incorrectCount})`],
                ['correct', `Correct (${stats.totalCorrect})`],
                ['coding', `Coding (${stats.codingTotal})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`exam-filter-btn ${filter === key ? 'exam-filter-btn--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Reviewed Questions List */}
        {filteredQuestions.length === 0 ? (
          <div className="exam-history-empty">
            <p>No questions match this filter.</p>
          </div>
        ) : (
          <div className="exam-report__list">
            {filteredQuestions.map(({ q, index, ok }) => {
              const res = results[q.id]
              const userChoice = assessment.answers[q.id]
              return (
                <article
                  key={q.id}
                  id={`report-${q.id}`}
                  className={`exam-review-card ${ok ? 'exam-review-card--ok' : 'exam-review-card--err'}`}
                  aria-labelledby={`${q.id}-report-title`}
                >
                  <div className="exam-q-header">
                    <div className="exam-q-meta">
                      <span className="exam-q-number" id={`${q.id}-report-title`}>
                        Question {index + 1}
                      </span>
                      <span className="exam-pill exam-pill--kind">{KIND_LABELS[q.kind]}</span>
                      <span className="exam-pill exam-pill--concept">
                        {formatConceptLabel(q.concept_id)}
                      </span>
                    </div>
                    <div className="exam-review-card__result">
                      <span className={`exam-status-pill ${ok ? 'exam-status-pill--passed' : 'exam-status-pill--failed'}`}>
                        {ok ? 'Correct · 1/1' : 'Incorrect · 0/1'}
                      </span>
                      {q.kind === 'coding' && res?.total !== undefined && (
                        <span className="exam-review-card__tests">
                          {res.passed ?? 0}/{res.total} tests passed
                        </span>
                      )}
                    </div>
                  </div>

                  <PromptRenderer prompt={q.prompt} />

                  {q.kind === 'coding' ? (
                    <div className="exam-report__editor">
                      <WorkspaceCodeEditor
                        key={q.id}
                        value={userChoice ?? q.starter_code ?? ''}
                        onChange={() => {}}
                        filename={`${q.function_name || 'solution'}.py`}
                        readOnly
                        autoFocus={false}
                        statusLabel="Submitted answer"
                      />
                    </div>
                  ) : (
                    <div className="exam-report__options">
                      {q.options.map((option, optIdx) => {
                        const isCorrectOption = q.correct_option_id === option.id
                        const isUserChoice = userChoice === option.id
                        const optionClass = isCorrectOption
                          ? 'exam-report-option--correct'
                          : isUserChoice
                          ? 'exam-report-option--wrong'
                          : ''

                        return (
                          <div key={option.id} className={`exam-report-option ${optionClass}`}>
                            <span className="exam-option-card__letter" aria-hidden="true">
                              {OPTION_LETTERS[optIdx] ?? optIdx + 1}
                            </span>
                            <span className="exam-option-card__text">
                              <InlineText text={option.text} />
                            </span>
                            {isCorrectOption && (
                              <span className="exam-report-option__tag exam-report-option__tag--ok">
                                Correct answer
                              </span>
                            )}
                            {!isCorrectOption && isUserChoice && (
                              <span className="exam-report-option__tag exam-report-option__tag--err">
                                Your answer
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {q.explanation && (
                    <div className="exam-explanation">
                      <strong>Explanation</strong>
                      <p>
                        <InlineText text={q.explanation} />
                      </p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
