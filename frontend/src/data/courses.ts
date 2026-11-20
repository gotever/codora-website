// Mock data for the Learning / Courses page

export interface Lesson {
  id: number | string
  number?: number
  title: string
  description: string
  completed?: boolean
}

export interface Course {
  id: number | string
  title: string
  lessonCount: number
  completedLessonCount?: number
  paceLabel?: string
  lessons: Lesson[]
}

export const COURSES: Course[] = [
  {
    id: 'python-fundamentals',
    title: 'Python fundamentals',
    lessonCount: 9,
    paceLabel: 'Go at your own pace',
    lessons: [
      {
        id: 1,
        title: 'Introduction to Python',
        description: 'Meet Python, run a first program, and learn the basic structure of Python code.',
      },
      {
        id: 2,
        title: 'Input and Output',
        description: 'Read user input, convert it when needed, and display results with print().',
      },
      {
        id: 3,
        title: 'Variables',
        description: 'Store values under clear names and reuse them in a program.',
      },
      {
        id: 4,
        title: 'Operators',
        description: 'Use arithmetic, comparison, logical, and assignment operators.',
      },
      {
        id: 5,
        title: 'Data Types',
        description: 'Work with numbers, text, Boolean values, and common collections.',
      },
      {
        id: 6,
        title: 'Conditional Statements and Loops',
        description: 'Choose branches with if statements and repeat work with for and while.',
      },
      {
        id: 7,
        title: 'Functions',
        description: 'Define reusable blocks of code that accept arguments and return values.',
      },
      {
        id: 8,
        title: 'Global and Local Variables',
        description: 'Understand variable scope and how functions read or update global names.',
      },
      {
        id: 9,
        title: 'Recursion',
        description: 'Solve a problem through smaller calls to the same function and a base case.',
      },
    ],
  },
]
