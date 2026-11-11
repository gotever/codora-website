// Mock data for the Learning / Courses page

export interface Lesson {
  id: number | string
  number?: number
  title: string
  description: string
}

export interface Course {
  id: string
  title: string
  lessonCount: number
  paceLabel?: string
  lessons: Lesson[]
}

export const COURSES: Course[] = [
  {
    id: 'python-fundamentals',
    title: 'Python fundamentals',
    lessonCount: 8,
    paceLabel: 'Go at your own pace',
    lessons: [
      {
        id: 1,
        title: 'Your first Python program',
        description: 'Meet Python and write a simple "Hello, world!"',
      },
      {
        id: 2,
        title: 'Variables and data types',
        description: 'Give your data a name and get to know the basics.',
      },
      {
        id: 3,
        title: 'Working with strings',
        description: 'Create, combine, and work with text in Python.',
      },
      {
        id: 4,
        title: 'Numbers and operators',
        description: 'Do calculations and explore everyday operations.',
      },
      {
        id: 5,
        title: 'Making decisions',
        description: 'Choose what happens next with if, elif, and else.',
      },
      {
        id: 6,
        title: 'Repeating with loops',
        description: 'Let for and while loops take care of repetition.',
      },
      {
        id: 7,
        title: 'Lists and collections',
        description: 'Keep related values together and work with them.',
      },
      {
        id: 8,
        title: 'Writing your own functions',
        description: 'Turn useful pieces of code into reusable building blocks.',
      },
    ],
  },
]
