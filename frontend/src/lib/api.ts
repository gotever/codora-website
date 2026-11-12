const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface AuthUser {
  id: string
  email: string
  username: string
  full_name: string
  level: 'beginner' | 'intermediate' | 'advanced'
  created_at: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`Yêu cầu thất bại (${status}). Vui lòng thử lại.`)
    this.status = status
    this.name = 'ApiError'
  }
}

export interface ApiCourse {
  id: number
  title: string
  description: string
  order_index: number
  lesson_count: number
}

export interface ApiLesson {
  id: number
  title: string
  course_id: number
  content_markdown: string
  order_index: number
}

export interface ApiExercise {
  id: number
  lesson_id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  description: string
  function_name: string
  starter_code: string
  test_cases: {
    runner: { id: string; label: string; input: string; inputLabel: string; expectedOutput: string; explanation?: string; argsExpression: string }[]
    examples: { id: number; input: string; output: string; explanation?: string }[]
    constraints: string[]
    functionSignature: string
    number: number
    total: number
    filename: string
    courseId: string
    courseTitle: string
  }
  hints: { level: 1 | 2 | 3; label: string; sublabel: string; content: string }[]
  tags: string[]
  course_id: number
  course_title: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return response.json() as Promise<T>
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return (await request<{ user: AuthUser }>('/api/auth/me')).user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return (await request<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).user
}

export async function register(input: { email: string; username: string; password: string; full_name: string }): Promise<AuthUser> {
  return (await request<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) })).user
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
}

export async function fetchCourses(): Promise<ApiCourse[]> {
  const result = await request<{ courses: ApiCourse[] }>('/api/courses')
  return result.courses
}

export async function fetchCourseLessons(courseId: number): Promise<ApiLesson[]> {
  const result = await request<{ lessons: ApiLesson[] }>(`/api/courses/${encodeURIComponent(courseId)}/lessons`)
  return result.lessons
}

export async function fetchLesson(id: string | number): Promise<ApiLesson> {
  const result = await request<{ lesson: ApiLesson }>(`/api/lessons/${encodeURIComponent(id)}`)
  return result.lesson
}

export interface ApiPersonalizedLesson {
  content_markdown: string
  ability: {
    level: 'beginner' | 'intermediate' | 'advanced'
    mastered_topics: string[]
    recent_quiz_avg: number
    consecutive_errors: number
  }
}

export async function personalizeLesson(id: string | number, consecutiveErrors = 0): Promise<ApiPersonalizedLesson> {
  return request(`/api/lessons/${encodeURIComponent(id)}/personalize`, {
    method: 'POST',
    body: JSON.stringify({ consecutive_errors: consecutiveErrors }),
  })
}

export async function fetchExercises(): Promise<ApiExercise[]> {
  const result = await request<{ exercises: ApiExercise[] }>('/api/exercises')
  return result.exercises
}

export async function fetchExercise(id: string | number): Promise<ApiExercise> {
  const result = await request<{ exercise: ApiExercise }>(`/api/exercises/${encodeURIComponent(id)}`)
  return result.exercise
}

export async function saveProgress(itemId: number, itemType: 'lesson' | 'exercise', status: 'not_started' | 'in_progress' | 'completed', score?: number) {
  return request('/api/progress', { method: 'PUT', body: JSON.stringify({ item_id: itemId, item_type: itemType, status, score }) })
}

export interface SubmitResult {
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Syntax Error'
  passed_count: number
  total_count: number
  runtime_ms: number
  error: string | null
  failed_case: {
    case_id?: string
    label?: string
    is_hidden: boolean
    actual?: string
    expected?: string
    error?: string
  } | null
}

export async function submitExercise(exerciseId: string, code: string): Promise<SubmitResult> {
  return request<SubmitResult>(`/api/exercises/${encodeURIComponent(exerciseId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export interface ApiChatMessage {
  id: string
  role: 'user' | 'assistant'
  message: string
  created_at: string
  exercise_id: number | null
  code_snapshot: string | null
}

export async function fetchChats(exerciseId?: number): Promise<ApiChatMessage[]> {
  const query = exerciseId === undefined ? '' : `?exercise_id=${encodeURIComponent(exerciseId)}`
  const result = await request<{ messages: ApiChatMessage[] }>(`/api/chats${query}`)
  return result.messages
}

export async function fetchContextChats(contextType: 'lesson' | 'exercise', contextId: number): Promise<ApiChatMessage[]> {
  const result = await request<{ messages: ApiChatMessage[] }>(`/api/chats?context_key=${encodeURIComponent(`${contextType}:${contextId}`)}`)
  return result.messages
}

export async function askTutor(input: {
  context_type: 'lesson' | 'exercise'
  context_id: number
  message: string
  code_snapshot?: string
  activity?: string
}): Promise<{ answer: string; memory_summary: string; structured_memory: Record<string, unknown> }> {
  return request('/api/tutor/chat', { method: 'POST', body: JSON.stringify(input) })
}

export async function saveChat(message: string, role: 'user' | 'assistant', exerciseId: number | null, codeSnapshot?: string) {
  return request('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ message, role, exercise_id: exerciseId, code_snapshot: codeSnapshot ?? null }),
  })
}
