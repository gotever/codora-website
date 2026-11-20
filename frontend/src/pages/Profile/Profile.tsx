import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  fetchCourses,
  fetchProgressSnapshot,
  updateLearningPreferences,
  type ApiCompletedLesson,
  type ApiConceptProgress,
  type ApiCourse,
  type ApiProgressSnapshot,
  type AuthUser,
  type LearningPreferences,
} from '../../lib/api'
import './Profile.css'

const EMPTY_PREFERENCES: LearningPreferences = {
  explanation_style: null,
  detail_level: null,
  hint_preference: null,
}

const CONCEPT_STATUS_LABELS: Record<ApiConceptProgress['status'], string> = {
  mastered: 'Mastered',
  demonstrated: 'Demonstrated',
  practicing: 'Practicing',
  studied: 'Studied',
  not_assessed: 'Not assessed',
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function ProfileLoading() {
  return (
    <main className="profile-page" id="main-content" role="status" aria-live="polite">
      <div className="profile-page__container">
        <p>Loading learner profile…</p>
      </div>
    </main>
  )
}

function SignInPrompt() {
  return (
    <main className="profile-page" id="main-content">
      <div className="profile-page__container profile-page__empty">
        <h1>Sign in to view your learner profile</h1>
        <p>Your personal details, learning progress, and preferences are saved to your account.</p>
        <Link to="/login" state={{ from: { pathname: '/profile' } }} className="profile-page__primary-link">
          Log in
        </Link>
      </div>
    </main>
  )
}

function AuthenticatedProfile({ user }: { user: AuthUser }) {
  const [preferences, setPreferences] = useState<LearningPreferences>(user.learning_preferences ?? EMPTY_PREFERENCES)
  const [snapshot, setSnapshot] = useState<ApiProgressSnapshot | null>(null)
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const { refresh } = useAuth()

  useEffect(() => {
    let active = true
    const refreshProgress = () => {
      Promise.all([fetchProgressSnapshot(), fetchCourses()])
        .then(([progressResult, courseResult]) => {
          if (!active) return
          setSnapshot(progressResult)
          setCourses(courseResult)
          setProgressError(false)
        })
        .catch(() => {
          if (active) setProgressError(true)
        })
        .finally(() => {
          if (active) setProgressLoading(false)
        })
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshProgress()
    }
    refreshProgress()
    window.addEventListener('focus', refreshProgress)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.removeEventListener('focus', refreshProgress)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [user.id])

  const handlePreferenceChange = (field: keyof LearningPreferences, value: string) => {
    setPreferences((current) => ({ ...current, [field]: value || null }))
    setSaveStatus('idle')
  }

  const handleSavePreferences = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaveStatus('saving')
    try {
      const saved = await updateLearningPreferences(preferences)
      setPreferences(saved)
      await refresh()
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  const completedLessons = snapshot?.completed_lessons ?? []
  const totalLessons = courses.reduce((total, course) => total + course.lesson_count, 0)
  const completedChallenges = snapshot?.completed_lesson_challenges ?? 0
  const completedExercises = snapshot?.progress.filter((item) => item.item_type === 'exercise' && item.status === 'completed').length ?? 0
  const hasLearningActivity = (snapshot?.progress.length ?? 0) > 0 || completedChallenges > 0
  const conceptsWithEvidence = (snapshot?.concepts ?? []).filter((concept) => concept.status !== 'not_assessed')
  const latestCompletedLessons = [...completedLessons]
    .sort((left, right) => new Date(right.completed_at).getTime() - new Date(left.completed_at).getTime())
    .slice(0, 4)

  return (
    <main className="profile-page" id="main-content">
      <div className="profile-page__container">
        <header className="profile-page__header">
          <span className="profile-page__eyebrow">YOUR LEARNING SPACE</span>
          <h1>Learner profile</h1>
          <p>Review your account, learning progress, and how Codora adapts lessons for you.</p>
        </header>

        <section className="profile-panel" aria-labelledby="personal-info-heading">
          <div className="profile-panel__heading">
            <div>
              <h2 id="personal-info-heading">Personal information</h2>
              <p>Basic details associated with your Codora account.</p>
            </div>
          </div>
          <dl className="profile-info-grid">
            <div className="profile-info-item">
              <dt>Full name</dt>
              <dd>{user.full_name}</dd>
            </div>
            <div className="profile-info-item">
              <dt>Username</dt>
              <dd>{user.username}</dd>
            </div>
            <div className="profile-info-item">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="profile-info-item">
              <dt>Current level</dt>
              <dd className="profile-info-item__capitalize">{user.level}</dd>
            </div>
            <div className="profile-info-item">
              <dt>Member since</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="profile-panel" aria-labelledby="learning-progress-heading">
          <div className="profile-panel__heading">
            <div>
              <h2 id="learning-progress-heading">Learning progress</h2>
              <p>Code challenges in lessons and exercises from the practice workspace are counted separately.</p>
            </div>
          </div>
          {progressLoading && <p role="status">Loading your learning progress…</p>}
          {progressError && <p className="profile-page__error" role="alert">Could not load learning progress. Please try again later.</p>}
          {!progressLoading && !progressError && snapshot && (
            hasLearningActivity ? (
              <>
                <div className="profile-progress-grid">
                  <div className="profile-stat-card">
                    <span className="profile-stat-card__value">{completedLessons.length}<span> / {totalLessons}</span></span>
                    <span className="profile-stat-card__label">Lessons completed</span>
                  </div>
                  <div className="profile-stat-card">
                    <span className="profile-stat-card__value">{completedChallenges}</span>
                    <span className="profile-stat-card__label">Code challenges completed</span>
                  </div>
                  <div className="profile-stat-card">
                    <span className="profile-stat-card__value">{completedExercises}</span>
                    <span className="profile-stat-card__label">Practice exercises completed</span>
                  </div>
                  <div className="profile-stat-card">
                    <span className="profile-stat-card__value">{conceptsWithEvidence.length}</span>
                    <span className="profile-stat-card__label">Concepts with learning evidence</span>
                  </div>
                </div>

                {latestCompletedLessons.length > 0 && (
                  <div className="profile-progress-subsection">
                    <h3>Recently completed lessons</h3>
                    <ul className="profile-activity-list">
                      {latestCompletedLessons.map((lesson: ApiCompletedLesson) => (
                        <li key={lesson.id}>
                          <span>{lesson.title}</span>
                          <time dateTime={lesson.completed_at}>{formatDate(lesson.completed_at)}</time>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {conceptsWithEvidence.length > 0 && (
                  <div className="profile-progress-subsection">
                    <h3>Concepts in progress</h3>
                    <ul className="profile-concept-list">
                      {conceptsWithEvidence.slice(0, 8).map((concept) => (
                        <li key={concept.id}>
                          <span>{concept.name}</span>
                          <span className={`profile-concept-status profile-concept-status--${concept.status}`}>
                            {CONCEPT_STATUS_LABELS[concept.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="profile-page__empty-state">
                <h3>Your learning progress will appear here</h3>
                <p>Complete lessons and code challenges to start building your learning history.</p>
                <Link to="/learning" className="profile-page__text-link">Explore lessons</Link>
              </div>
            )
          )}
        </section>

        <section className="profile-panel" aria-labelledby="learning-preferences-heading">
          <div className="profile-panel__heading">
            <div>
              <h2 id="learning-preferences-heading">Learning preferences</h2>
              <p>Choose how the AI tutor explains ideas and gives hints. You can change these any time.</p>
            </div>
          </div>
          <form className="profile-preferences-form" onSubmit={handleSavePreferences}>
            <label className="profile-field">
              <span>Explanation style</span>
              <select
                value={preferences.explanation_style ?? ''}
                onChange={(event) => handlePreferenceChange('explanation_style', event.target.value)}
              >
                <option value="">No preference</option>
                <option value="step_by_step">Step by step</option>
                <option value="conceptual">Conceptual</option>
                <option value="direct">Direct</option>
              </select>
              <small>Choose the structure that helps you understand new concepts.</small>
            </label>

            <label className="profile-field">
              <span>Explanation detail</span>
              <select
                value={preferences.detail_level ?? ''}
                onChange={(event) => handlePreferenceChange('detail_level', event.target.value)}
              >
                <option value="">No preference</option>
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
              <small>Set how much context and example detail the tutor should provide.</small>
            </label>

            <label className="profile-field">
              <span>Hint style</span>
              <select
                value={preferences.hint_preference ?? ''}
                onChange={(event) => handlePreferenceChange('hint_preference', event.target.value)}
              >
                <option value="">No preference</option>
                <option value="progressive">Progressive hints</option>
                <option value="minimal">Minimal hints</option>
                <option value="direct">Direct next step</option>
              </select>
              <small>Choose how much guidance to receive before seeing the next step.</small>
            </label>

            <div className="profile-preferences-form__actions">
              <button type="submit" className="profile-page__primary-button" disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? 'Saving…' : 'Save preferences'}
              </button>
              {saveStatus === 'saved' && <span className="profile-page__success" role="status">Preferences saved.</span>}
              {saveStatus === 'error' && <span className="profile-page__error" role="alert">Could not save preferences. Please try again.</span>}
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

export default function Profile() {
  const { user, loading } = useAuth()
  if (loading) return <ProfileLoading />
  if (!user) return <SignInPrompt />
  return <AuthenticatedProfile key={user.id} user={user} />
}
