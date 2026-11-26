import { Link } from 'react-router-dom'
import type { AssessmentHistory, AuthUser } from '../../../lib/api'
import { formatDate } from './assessmentUtils'

interface AssessmentLobbyProps {
  user: AuthUser
  history: AssessmentHistory
  busy: boolean
  creating: boolean
  onCreate: () => void
  onLoadMore: () => void
}

export default function AssessmentLobby({
  user,
  history,
  busy,
  creating,
  onCreate,
  onLoadMore,
}: AssessmentLobbyProps) {
  const requiredMastered = history.required_mastered ?? 4
  const masteredCount = history.mastered_count ?? 0
  const lessonsDone = history.completed_count >= 6
  const masteryDone = masteredCount >= requiredMastered
  const lessonPct = Math.min(100, Math.round((history.completed_count / 6) * 100))
  const masteryPct = Math.min(100, Math.round((masteredCount / requiredMastered) * 100))

  return (
    <div className="exam-lobby">
      <div className="exam-lobby__container">
        <header className="exam-lobby__header">
          <Link to="/profile" className="exam-lobby__back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Learner profile
          </Link>
          <span className="exam-lobby__eyebrow">ADAPTIVE ASSESSMENT</span>
          <h1>Tests &amp; Assessments</h1>
          <p>
            Verify your understanding of Python fundamentals with a personalized exam tailored to your concept mastery and recurring error patterns.
          </p>
        </header>

        {creating && (
          <section className="exam-generating-card" role="status" aria-live="polite">
            <div className="exam-generating-card__spinner" aria-hidden="true" />
            <div className="exam-generating-card__copy">
              <p className="exam-generating-card__eyebrow">PREPARING YOUR EXAM</p>
              <h2>Generating personalized questions…</h2>
              <p>
                Analyzing your concept progress, selecting 7 multiple-choice and 3 Python coding problems, and validating test cases in our sandbox. This usually takes 10–25 seconds.
              </p>
            </div>
            <div className="exam-generating-card__progress" aria-hidden="true" />
          </section>
        )}

        <section className="exam-briefing-card" aria-labelledby="exam-briefing-title">
          <div className="exam-briefing-card__top">
            <div>
              <span className="exam-briefing-card__kicker">BEGINNER → INTERMEDIATE</span>
              <h2 id="exam-briefing-title">Python Fundamentals Promotion Assessment</h2>
            </div>
            <span className={`exam-status-pill ${history.unlocked ? 'exam-status-pill--passed' : 'exam-status-pill--locked'}`}>
              {history.unlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>

          <div className="exam-unlock-grid">
            <div className="exam-unlock-meter">
              <div className="exam-unlock-meter__labels">
                <span>First 6 lessons</span>
                <strong>{history.completed_count} / 6 completed</strong>
              </div>
              <div className="exam-unlock-meter__track" role="progressbar" aria-valuenow={history.completed_count} aria-valuemin={0} aria-valuemax={6}>
                <div
                  className={`exam-unlock-meter__fill ${lessonsDone ? 'exam-unlock-meter__fill--done' : ''}`}
                  style={{ width: `${lessonPct}%` }}
                />
              </div>
              {!lessonsDone && (
                <p className="exam-unlock-meter__hint">
                  Complete the first six lessons in Python fundamentals.{' '}
                  <Link to="/learning">Go to Learning →</Link>
                </p>
              )}
            </div>

            <div className="exam-unlock-meter">
              <div className="exam-unlock-meter__labels">
                <span>Mastered concepts</span>
                <strong>{masteredCount} / {requiredMastered} mastered</strong>
              </div>
              <div className="exam-unlock-meter__track" role="progressbar" aria-valuenow={masteredCount} aria-valuemin={0} aria-valuemax={requiredMastered}>
                <div
                  className={`exam-unlock-meter__fill ${masteryDone ? 'exam-unlock-meter__fill--done' : ''}`}
                  style={{ width: `${masteryPct}%` }}
                />
              </div>
              <p className="exam-unlock-meter__hint">
                Complete at least 2 distinct Exercises (score &ge; 8/10) per concept.
                {!masteryDone && (
                  <>
                    {' '}
                    <Link to="/exercises">Go to Exercises →</Link>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="exam-specs-grid">
            <div className="exam-spec-item">
              <span className="exam-spec-item__label">Format</span>
              <strong className="exam-spec-item__value">10 Questions</strong>
              <span className="exam-spec-item__sub">7 MCQ + 3 Python coding</span>
            </div>
            <div className="exam-spec-item">
              <span className="exam-spec-item__label">Passing Score</span>
              <strong className="exam-spec-item__value">8 / 10</strong>
              <span className="exam-spec-item__sub">1 pt per question · all tests pass</span>
            </div>
            <div className="exam-spec-item">
              <span className="exam-spec-item__label">Pacing</span>
              <strong className="exam-spec-item__value">No Time Limit</strong>
              <span className="exam-spec-item__sub">Optional elapsed clock · autosaved</span>
            </div>
            <div className="exam-spec-item">
              <span className="exam-spec-item__label">Current Level</span>
              <strong className="exam-spec-item__value exam-spec-item__value--cap">{user.level}</strong>
              <span className="exam-spec-item__sub">Pass 8/10 to promote to Intermediate</span>
            </div>
          </div>

          <div className="exam-briefing-card__actions">
            <button
              type="button"
              className="exam-btn exam-btn--primary exam-btn--lg"
              onClick={onCreate}
              disabled={!history.unlocked || busy}
            >
              {creating
                ? 'Generating test…'
                : busy
                ? 'Opening test…'
                : history.active_id
                ? 'Resume unfinished assessment'
                : 'Start new assessment'}
            </button>
            <p className="exam-briefing-card__footnote">
              {history.active_id
                ? 'You have an in-progress attempt with saved drafts. Resuming restores your latest answers.'
                : 'Your answers save automatically as you work. Coding solutions are officially graded on the server against hidden test cases upon submission.'}
            </p>
          </div>
        </section>

        <section className="exam-history-card" aria-labelledby="exam-history-title">
          <div className="exam-history-card__header">
            <div>
              <h2 id="exam-history-title">Assessment history</h2>
              <p>Review past scorecards, explanations, and submitted solutions.</p>
            </div>
          </div>

          {!history.assessments.length ? (
            <div className="exam-history-empty">
              <p>No assessments taken yet. Start your first test above once unlocked.</p>
            </div>
          ) : (
            <div className="exam-history-table-wrap">
              <table className="exam-history-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Score</th>
                    <th scope="col" className="exam-history-table__action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.assessments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/assessments/${item.id}`} className="exam-history-table__date-link">
                          {formatDate(item.created_at)}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`exam-status-pill ${
                            item.status === 'passed'
                              ? 'exam-status-pill--passed'
                              : item.status === 'failed'
                              ? 'exam-status-pill--failed'
                              : 'exam-status-pill--active'
                          }`}
                        >
                          {item.status === 'in_progress'
                            ? 'In progress'
                            : item.status === 'passed'
                            ? 'Passed'
                            : 'Needs practice'}
                        </span>
                      </td>
                      <td className="exam-history-table__score">
                        {item.score !== null ? `${item.score} / 10` : '—'}
                      </td>
                      <td className="exam-history-table__action-col">
                        <Link to={`/assessments/${item.id}`} className="exam-history-table__cta">
                          {item.status === 'in_progress' ? 'Resume →' : 'View report →'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.has_more && (
            <div className="exam-history-card__more">
              <button type="button" className="exam-btn exam-btn--secondary" disabled={busy} onClick={onLoadMore}>
                Load older tests
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
