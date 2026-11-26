import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  createAssessment,
  fetchAssessment,
  fetchAssessmentHistory,
  saveAssessmentDraft,
  submitAssessment,
  type Assessment,
  type AssessmentHistory,
} from '../../lib/api'
import AssessmentExam from './components/AssessmentExam'
import AssessmentLobby from './components/AssessmentLobby'
import AssessmentReport from './components/AssessmentReport'
import { errorMessage } from './components/assessmentUtils'
import './Assessments.css'

export default function Assessments() {
  const { id } = useParams()
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState<AssessmentHistory | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('')
  const [ready, setReady] = useState(false)
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null)
  const userId = user?.id
  const edited = useRef(false)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const routeId = useRef(id)
  const draftKey = `codora-assessment:${userId}:${id}`

  const clearLocalDraft = useCallback(
    (snapshot: Record<string, string>) => {
      try {
        if (sessionStorage.getItem(draftKey) === JSON.stringify(snapshot)) {
          sessionStorage.removeItem(draftKey)
        }
      } catch {
        // The server remains the persistent store when browser storage is unavailable.
      }
    },
    [draftKey],
  )

  useEffect(() => {
    let active = true
    routeId.current = id
    edited.current = false
    if (!userId) return
    const request = id ? fetchAssessment(id) : fetchAssessmentHistory()
    request
      .then((result) => {
        if (!active) return
        if ('questions' in result) {
          setAssessment(result)
          let restored = result.answers
          if (result.status === 'in_progress') {
            try {
              const local: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
              if (
                local &&
                typeof local === 'object' &&
                !Array.isArray(local) &&
                Object.values(local).every((v) => typeof v === 'string')
              ) {
                restored = local as Record<string, string>
                edited.current = true
                setSaveState('Restored unsaved changes')
              }
            } catch {
              // Ignore unavailable browser storage.
            }
          }
          setAnswers(restored)
        } else {
          setHistory(result)
        }
        setLoadedOwner(userId)
        setReady(true)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
    return () => {
      active = false
    }
  }, [id, userId, draftKey])

  // Queue writes so a slower earlier request cannot overwrite newer answers.
  useEffect(() => {
    if (!assessment || assessment.status !== 'in_progress' || !edited.current || busy) return
    const target = assessment.id
    const timer = window.setTimeout(() => {
      setSaveState('Saving draft…')
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveAssessmentDraft(target, answers))
        .then(() => {
          clearLocalDraft(answers)
          if (routeId.current === target) setSaveState('Draft saved')
        })
        .catch(() => {
          if (routeId.current === target) {
            setSaveState('Draft not saved. Use Save draft to retry.')
          }
        })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [answers, assessment, busy, clearLocalDraft])

  // Warn before leaving the tab when unsaved changes have not synced to the server yet.
  useEffect(() => {
    const hasPendingSync =
      assessment?.status === 'in_progress' &&
      (saveState === 'Unsaved changes' ||
        saveState === 'Saving draft…' ||
        saveState.includes('not saved'))
    if (!hasPendingSync) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [assessment?.status, saveState])

  function change(key: string, value: string) {
    edited.current = true
    setAnswers((current) => {
      const next = { ...current }
      if (value.trim()) next[key] = value
      else delete next[key]
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(next))
      } catch {
        // Server autosave still applies.
      }
      return next
    })
    setSaveState('Unsaved changes')
  }

  async function save() {
    if (!assessment) return
    setBusy(true)
    setError('')
    try {
      await saveQueue.current.catch(() => {})
      await saveAssessmentDraft(assessment.id, answers)
      clearLocalDraft(answers)
      setSaveState('Draft saved')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    setBusy(true)
    setCreating(!history?.active_id)
    setError('')
    try {
      const result = await createAssessment()
      navigate(`/assessments/${result.id}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      setCreating(false)
    }
  }

  async function moreHistory() {
    if (!history) return
    setBusy(true)
    setError('')
    try {
      const next = await fetchAssessmentHistory(history.assessments.length)
      setHistory({
        ...next,
        assessments: [...history.assessments, ...next.assessments],
      })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!assessment) return
    setBusy(true)
    setError('')
    try {
      await saveQueue.current.catch(() => {})
      // Persist current draft before invoking the grader, including when the grader is unavailable.
      await saveAssessmentDraft(assessment.id, answers)
      const result = await submitAssessment(assessment.id, answers)
      clearLocalDraft(answers)
      edited.current = false
      setAssessment(result)
      setAnswers(result.answers)
      setSaveState('')
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="exam-state-page" id="main-content" role="status">
        <div className="exam-state-card">
          <div className="exam-generating-card__spinner" aria-hidden="true" />
          <p>Loading assessment workspace…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="exam-state-page" id="main-content">
        <div className="exam-state-card">
          <h1>Personalized Assessments</h1>
          <p>Sign in to take your personalized exam and review your test history.</p>
          <div className="exam-state-card__actions">
            <Link
              to="/login"
              state={{ from: { pathname: id ? `/assessments/${id}` : '/assessments' } }}
              className="exam-btn exam-btn--primary"
            >
              Log in
            </Link>
            <Link to="/" className="exam-btn exam-btn--secondary">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (ready && loadedOwner !== user.id) {
    return (
      <main className="exam-state-page" id="main-content" role="status">
        <div className="exam-state-card">
          <p>{error || 'Loading tests…'}</p>
        </div>
      </main>
    )
  }

  if (id && !assessment && error) {
    return (
      <main className="exam-state-page" id="main-content">
        <div className="exam-state-card">
          <h1>Unable to open assessment</h1>
          <p className="exam-banner-error__text" role="alert">{error}</p>
          <div className="exam-state-card__actions">
            <Link to="/assessments" className="exam-btn exam-btn--primary">
              Back to Tests &amp; History
            </Link>
            <button
              type="button"
              className="exam-btn exam-btn--secondary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (id && !assessment) {
    return (
      <main className="exam-state-page" id="main-content" role="status">
        <div className="exam-state-card">
          <div className="exam-generating-card__spinner" aria-hidden="true" />
          <p>Loading assessment…</p>
        </div>
      </main>
    )
  }

  if (assessment) {
    if (assessment.status === 'in_progress') {
      return (
        <AssessmentExam
          assessment={assessment}
          userId={user.id}
          answers={answers}
          saveState={saveState}
          busy={busy}
          error={error}
          onAnswerChange={change}
          onSaveDraft={save}
          onSubmit={submit}
          onReload={() => window.location.reload()}
        />
      )
    }

    return (
      <AssessmentReport
        assessment={assessment}
        user={user}
        busy={busy}
        onCreateNew={create}
      />
    )
  }

  return (
    <main className="exam-lobby-wrap" id="main-content">
      {error && (
        <div className="exam-lobby__error-wrap">
          <div className="exam-banner-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="exam-btn exam-btn--ghost exam-btn--sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {!ready && !error && (
        <div className="exam-state-card exam-state-card--inline" role="status">
          <div className="exam-generating-card__spinner" aria-hidden="true" />
          <p>Loading tests &amp; history…</p>
        </div>
      )}

      {history && (
        <AssessmentLobby
          user={user}
          history={history}
          busy={busy}
          creating={creating}
          onCreate={create}
          onLoadMore={moreHistory}
        />
      )}
    </main>
  )
}
