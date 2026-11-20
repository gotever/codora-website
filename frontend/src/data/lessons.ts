// ============================================================
// Mock data and TypeScript interfaces for Codora Lessons
// ============================================================

export type LessonStatus = 'completed' | 'in_progress' | 'upcoming'

export interface TestCase {
  id: string
  call: string
  expected: string
  input?: string
  actual?: string
  passed?: boolean
}

export interface CodingChallenge {
  id: string
  title: string
  description: string
  practiceLabel: string
  filename: string
  language: string
  initialCode: string
  solutionCode?: string
  testCases: TestCase[]
}

export interface LessonChallengeContext {
  title: string
  description: string
  code: string
  runResult: string
}

export interface CodeExample {
  filename: string
  language: string
  code: string
  caption?: string
}

export interface LessonSection {
  id: string
  number: string
  title: string
  paragraphs: string[]
  codeExample?: CodeExample
  challenge?: CodingChallenge
  takeaway?: {
    label: string
    text: string
  }
}

export interface LessonDetail {
  id: string
  lessonNumber: number
  moduleNumber: string
  moduleName: string
  topic: string
  title: string
  description: string
  duration: string
  exerciseCount: number
  language: string
  status: LessonStatus
  sections: LessonSection[]
  prevLesson?: {
    id: string
    title: string
  }
  nextLesson?: {
    id: string
    title: string
  }
}

export interface CourseNavLesson {
  id: string
  number: string
  title: string
  duration: string
  status: LessonStatus
}

export interface CourseNavModule {
  id: string
  number: string
  title: string
  lessons: CourseNavLesson[]
}

export interface CourseNavigation {
  id: string
  title: string
  description: string
  totalLessons: number
  completedLessons: number
  modules: CourseNavModule[]
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text?: string
  timestamp: string
  title?: string
  paragraphs?: string[]
  comparison?: {
    itemA: { label: string; description: string }
    itemB: { label: string; description: string }
  }
  analogy?: {
    label: string
    lines: string[]
  }
  closing?: string
  feedbackGiven?: 'yes' | 'no' | null
}

export const INITIAL_ASSISTANT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1', sender: 'user', text: 'Why do we need return instead of print()?', timestamp: 'TODAY',
  },
  {
    id: 'msg-2', sender: 'assistant', title: 'Great question. They do different jobs.',
    paragraphs: ['return sends a value back so your program can use it. print() just displays a value for you to see.'],
    comparison: {
      itemA: { label: 'return', description: 'Gives a result back to your program.' },
      itemB: { label: 'print()', description: 'Prints a message to the console.' },
    },
    analogy: {
      label: 'THINK OF IT THIS WAY',
      lines: ['A coffee machine returns your coffee.', 'A screen that says "Coffee is ready" is more like print().', 'Only one gives you something to use.'],
    },
    closing: "Try spotting the value our function sends back. That's the value you can reuse.",
    timestamp: 'Just now', feedbackGiven: null,
  },
]

export { COURSE_NAV_DATA, LESSON_DETAILS } from './gfgLessons.ts'
