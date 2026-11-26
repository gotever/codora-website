import { ApiError, type AssessmentKind, type AssessmentQuestion } from '../../../lib/api'

export const KIND_LABELS: Record<AssessmentKind, string> = {
  knowledge: 'Knowledge',
  code_tracing: 'Code tracing',
  debugging: 'Debugging',
  conceptual_reasoning: 'Conceptual reasoning',
  coding: 'Coding',
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D']

export function formatConceptLabel(conceptId: string): string {
  const stripped = conceptId.replace(/^python\./, '')
  return stripped
    .split('.')
    .filter(Boolean)
    .map((segment) => {
      const words = segment.replace(/_/g, ' ').trim()
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
    })
    .filter(Boolean)
    .join(' · ')
}

export function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function isQuestionAnswered(
  question: AssessmentQuestion,
  answers: Record<string, string>,
): boolean {
  return Boolean(answers[question.id]?.trim())
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Complete the first six lessons and master at least four concepts in Exercises to unlock this test.'
    if (error.status === 404) return 'This test could not be found.'
    if (error.status === 422) return 'Please answer all ten questions before submitting.'
    if (error.status === 503) return 'AI or the coding grader is unavailable. Your test remains unsubmitted; please try again.'
    if (error.status === 502) return 'AI could not generate a valid test. Please try again.'
  }
  return 'Could not complete this request. Please try again.'
}
