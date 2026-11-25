import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError, createAssessment, fetchAssessment, fetchAssessmentHistory, saveAssessmentDraft, submitAssessment,
  type Assessment, type AssessmentHistory, type AssessmentKind } from '../../lib/api'
import WorkspaceCodeEditor from '../ExerciseWorkspace/components/WorkspaceCodeEditor/WorkspaceCodeEditor'
import './Assessments.css'

const LABELS: Record<AssessmentKind, string> = {
  knowledge: 'Knowledge', code_tracing: 'Code tracing', debugging: 'Debugging', conceptual_reasoning: 'Conceptual reasoning', coding: 'Coding',
}
const date = (s: string) => new Date(s).toLocaleString()
function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Complete the first six lessons to unlock this test.'
    if (error.status === 404) return 'This test could not be found.'
    if (error.status === 422) return 'Please answer all ten questions before submitting.'
    if (error.status === 503) return 'AI or the coding grader is unavailable. Your test remains unsubmitted; please try again.'
    if (error.status === 502) return 'AI could not generate a valid test. Please try again.'
  }
  return 'Could not complete this request. Please try again.'
}

export default function Assessments() {
  const { id } = useParams()
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState<AssessmentHistory | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('')
  const [ready, setReady] = useState(false)
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null)
  const userId = user?.id
  const edited = useRef(false)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const routeId = useRef(id)
  const draftKey = `codora-assessment:${userId}:${id}`

  const clearLocalDraft = useCallback((snapshot: Record<string, string>) => {
    try {
      if (sessionStorage.getItem(draftKey) === JSON.stringify(snapshot)) sessionStorage.removeItem(draftKey)
    } catch { /* The server remains the persistent store when browser storage is unavailable. */ }
  }, [draftKey])

  useEffect(() => {
    let active = true
    routeId.current = id
    edited.current = false
    if (!userId) return
    const request = id ? fetchAssessment(id) : fetchAssessmentHistory()
    request.then(result => {
      if (!active) return
      if ('questions' in result) {
        setAssessment(result)
        let restored = result.answers
        if (result.status === 'in_progress') {
          try {
            const local: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
            if (local && typeof local === 'object' && !Array.isArray(local) && Object.values(local).every(v => typeof v === 'string')) {
              restored = local as Record<string, string>
              edited.current = true
              setSaveState('Restored unsaved changes')
            }
          } catch { /* Ignore unavailable browser storage. */ }
        }
        setAnswers(restored)
      }
      else setHistory(result)
      setLoadedOwner(userId)
      setReady(true)
    }).catch(e => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [id, userId, draftKey])

  // Queue writes so a slower earlier request cannot overwrite newer answers.
  useEffect(() => {
    if (!assessment || assessment.status !== 'in_progress' || !edited.current || busy) return
    const target = assessment.id
    const timer = window.setTimeout(() => {
      setSaveState('Saving draft…')
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveAssessmentDraft(target, answers))
        .then(() => {
          clearLocalDraft(answers)
          if (routeId.current === target) setSaveState('Draft saved')
        })
        .catch(() => { if (routeId.current === target) setSaveState('Draft not saved. Use Save draft to retry.') })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [answers, assessment, busy, clearLocalDraft])

  function change(key: string, value: string) {
    edited.current = true
    setAnswers(current => {
      const next = { ...current }
      if (value.trim()) next[key] = value
      else delete next[key]
      try { sessionStorage.setItem(draftKey, JSON.stringify(next)) } catch { /* Server autosave still applies. */ }
      return next
    })
    setSaveState('Unsaved changes')
  }
  async function save() {
    if (!assessment) return
    setBusy(true); setError('')
    try { await saveQueue.current.catch(() => {}); await saveAssessmentDraft(assessment.id, answers); clearLocalDraft(answers); setSaveState('Draft saved') }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function create() {
    setBusy(true); setError('')
    try { const result = await createAssessment(); navigate(`/assessments/${result.id}`) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function moreHistory() {
    if (!history) return
    setBusy(true); setError('')
    try {
      const next = await fetchAssessmentHistory(history.assessments.length)
      setHistory({ ...next, assessments: [...history.assessments, ...next.assessments] })
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function submit() {
    if (!assessment || !window.confirm('Submit this test? Your answers will be final.')) return
    setBusy(true); setError('')
    try {
      await saveQueue.current.catch(() => {})
      // Persist current draft before invoking the grader, including when the grader is unavailable.
      await saveAssessmentDraft(assessment.id, answers)
      const result = await submitAssessment(assessment.id, answers)
      clearLocalDraft(answers)
      edited.current = false
      setAssessment(result); setAnswers(result.answers); setSaveState('')
      await refresh()
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }

  if (loading) return <main className="assessment-page" role="status">Loading…</main>
  if (!user) return <main className="assessment-page"><h1>Personalized tests</h1><p><Link to="/login" state={{ from: { pathname: '/assessments' } }}>Log in</Link> to take tests and view your history.</p></main>
  if (ready && loadedOwner !== user.id) return <main className="assessment-page" role="status">{error || 'Loading tests…'}</main>
  const readonly = assessment?.status !== 'in_progress'
  return <main className="assessment-page" id="main-content">
    <header><Link to="/profile">Learner profile</Link><h1>{id ? 'Personalized assessment' : 'Tests & history'}</h1>
      <p>7 multiple-choice questions and 3 Python coding questions, personalized around your concepts and recurring mistakes.</p></header>
    {error && <p role="alert" className="assessment-error">{error} <button onClick={() => window.location.reload()}>Reload</button></p>}
    {!ready && !error && <p role="status">Loading tests…</p>}
    {!id && history && <>
      <section className="assessment-panel"><h2>Beginner → Intermediate</h2>
        <p>{history.completed_count}/6 first lessons completed. {history.unlocked ? 'Your assessment is unlocked.' : 'Complete all six to unlock your assessment.'}</p>
        <p>Pass mark: 8/10. Promotion also requires four mastered concepts. Each correct question earns one point; coding questions require all test cases to pass.</p>
        <button className="assessment-primary" onClick={create} disabled={!history.unlocked || busy}>
          {busy ? 'Processing…' : history.active_id ? 'Continue unfinished test' : 'Create new test'}
        </button><p>Creating a test resumes your unfinished test. After submission, you can generate a new one.</p>
      </section>
      <section className="assessment-panel"><h2>Test history</h2>
        {!history.assessments.length && <p>No tests yet.</p>}
        <ul className="assessment-history">{history.assessments.map(a => <li key={a.id}>
          <Link to={`/assessments/${a.id}`}>{date(a.created_at)}</Link><span>{a.status === 'in_progress' ? 'In progress' : `${a.status === 'passed' ? 'Passed' : 'Needs practice'} · ${a.score}/10`}</span>
        </li>)}</ul>
        {history.has_more && <button disabled={busy} onClick={moreHistory}>Load older tests</button>}
      </section>
    </>}
    {assessment && <>
      <p><Link to="/assessments">← Test history</Link> · {date(assessment.created_at)}</p>
      {readonly && <section className="assessment-panel" role="status"><h2>{assessment.status === 'passed' ? 'Test passed' : 'Keep practicing'} · {assessment.score}/10</h2>
        <p>{user.level === 'intermediate' ? 'Your level is Intermediate.' : assessment.status === 'passed' ? 'Test requirement met. Master four concepts to complete your promotion.' : 'Review your answers below, then create a new test when you are ready.'}</p></section>}
      {assessment.questions.map((q, index) => <section className="assessment-panel" key={q.id} aria-labelledby={`${q.id}-title`}>
        <span className="assessment-kind">{LABELS[q.kind]} · {q.concept_id}</span>
        <h2 id={`${q.id}-title`}>Question {index + 1}</h2><pre className="assessment-prompt">{q.prompt}</pre>
        {q.kind === 'coding' ? <div className="assessment-editor"><WorkspaceCodeEditor value={answers[q.id] ?? q.starter_code ?? ''}
          onChange={v => change(q.id, v)} filename={`${q.function_name}.py`} readOnly={readonly || busy} statusLabel={readonly ? 'Submitted answer' : saveState || 'Edit to start your answer'} /></div> :
          <fieldset disabled={readonly || busy}><legend className="assessment-sr">Choose an answer for question {index + 1}</legend>
            {q.options.map(o => <label className="assessment-option" key={o.id}><input type="radio" name={q.id} checked={answers[q.id] === o.id}
              onChange={() => change(q.id, o.id)} /><span>{o.text}</span></label>)}</fieldset>}
        {readonly && <div className="assessment-feedback"><strong>{assessment.results?.[q.id]?.correct ? 'Correct' : 'Incorrect'}</strong>
          {q.kind === 'coding' && <span> · {assessment.results?.[q.id]?.passed}/{assessment.results?.[q.id]?.total} tests passed</span>}
          {q.correct_option_id && <p>Correct answer: {q.options.find(o => o.id === q.correct_option_id)?.text}</p>}
          <p>{q.explanation}</p></div>}
      </section>)}
      {!readonly && <div className="assessment-actions"><span role="status">{busy ? 'Processing…' : saveState || 'Drafts are saved automatically after editing.'}</span>
        <button disabled={busy} onClick={save}>Save draft</button><button className="assessment-primary" disabled={busy || Object.keys(answers).length !== 10} onClick={submit}>Submit test</button></div>}
    </>}
  </main>
}
