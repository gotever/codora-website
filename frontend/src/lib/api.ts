const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface ApiCourse {
  id: string
  title: string
  description: string
  order_index: number
  lesson_count: number
}

export interface ApiExercise {
  id: string
  lesson_id: string
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
  course_id: string
  course_title: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function fetchCourses(): Promise<ApiCourse[]> {
  const result = await request<{ courses: ApiCourse[] }>('/api/courses')
  return result.courses
}

export async function fetchExercises(): Promise<ApiExercise[]> {
  const result = await request<{ exercises: ApiExercise[] }>('/api/exercises')
  return result.exercises
}

export async function fetchExercise(id: string): Promise<ApiExercise> {
  const result = await request<{ exercise: ApiExercise }>(`/api/exercises/${encodeURIComponent(id)}`)
  return result.exercise
}

export async function saveProgress(itemId: string, itemType: 'lesson' | 'exercise', status: 'not_started' | 'in_progress' | 'completed') {
  return request('/api/progress', { method: 'PUT', body: JSON.stringify({ item_id: itemId, item_type: itemType, status }) })
}

export interface ApiChatMessage {
  id: string
  role: 'user' | 'assistant'
  message: string
  created_at: string
  exercise_id: string | null
  code_snapshot: string | null
}

export async function fetchChats(exerciseId?: string): Promise<ApiChatMessage[]> {
  const query = exerciseId ? `?exercise_id=${encodeURIComponent(exerciseId)}` : ''
  const result = await request<{ messages: ApiChatMessage[] }>(`/api/chats${query}`)
  return result.messages
}

export async function saveChat(message: string, role: 'user' | 'assistant', exerciseId: string | null, codeSnapshot?: string) {
  return request('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ message, role, exercise_id: exerciseId, code_snapshot: codeSnapshot ?? null }),
  })
}
