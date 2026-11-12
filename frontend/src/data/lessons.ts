// ============================================================
// Mock data and TypeScript interfaces for Codora Lessons
// ============================================================

export type LessonStatus = 'completed' | 'in_progress' | 'upcoming'

export interface TestCase {
  id: string
  call: string
  expected: string
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

// ----------------------------------------------------------------
// Course Navigation Mock Data (12 Lessons, 3 Completed, Lesson 4 In Progress)
// ----------------------------------------------------------------

export const COURSE_NAV_DATA: CourseNavigation = {
  id: 'python-foundations',
  title: 'Python foundations',
  description: 'Build a strong coding foundation.',
  totalLessons: 12,
  completedLessons: 3,
  modules: [
    {
      id: 'module-01',
      number: '01',
      title: 'GETTING STARTED',
      lessons: [
        {
          id: '1',
          number: '01',
          title: 'Welcome to Python',
          duration: '4 min',
          status: 'completed',
        },
        {
          id: '2',
          number: '02',
          title: 'Variables & data types',
          duration: '12 min',
          status: 'completed',
        },
        {
          id: '3',
          number: '03',
          title: 'Operators & expressions',
          duration: '10 min',
          status: 'completed',
        },
      ],
    },
    {
      id: 'module-02',
      number: '02',
      title: 'BUILDING BLOCKS',
      lessons: [
        {
          id: '4',
          number: '04',
          title: 'Functions',
          duration: '15 min',
          status: 'in_progress',
        },
        {
          id: '5',
          number: '05',
          title: 'Scope & closures',
          duration: '18 min',
          status: 'upcoming',
        },
        {
          id: '6',
          number: '06',
          title: 'Lists & dictionaries',
          duration: '20 min',
          status: 'upcoming',
        },
        {
          id: '7',
          number: '07',
          title: 'Loops & iteration',
          duration: '16 min',
          status: 'upcoming',
        },
      ],
    },
    {
      id: 'module-03',
      number: '03',
      title: 'ADVANCED CONCEPTS',
      lessons: [
        {
          id: '8',
          number: '08',
          title: 'Conditionals & logic',
          duration: '14 min',
          status: 'upcoming',
        },
        {
          id: '9',
          number: '09',
          title: 'Working with modules',
          duration: '15 min',
          status: 'upcoming',
        },
        {
          id: '10',
          number: '10',
          title: 'Error handling & debug',
          duration: '22 min',
          status: 'upcoming',
        },
        {
          id: '11',
          number: '11',
          title: 'File I/O basics',
          duration: '18 min',
          status: 'upcoming',
        },
        {
          id: '12',
          number: '12',
          title: 'Final mini project',
          duration: '30 min',
          status: 'upcoming',
        },
      ],
    },
  ],
}

// ----------------------------------------------------------------
// Sample Lesson Detail Mock Data (Lesson 04: Functions)
// ----------------------------------------------------------------

export const LESSON_DETAILS: Record<string, LessonDetail> = {
  '1': {
    id: '1',
    lessonNumber: 1,
    moduleNumber: '01',
    moduleName: 'GETTING STARTED',
    topic: 'Welcome to Python',
    title: 'Your very first Python program.',
    description:
      'Discover what Python is, why millions of developers love it, and write your first working line of code.',
    duration: '4 min lesson',
    exerciseCount: 1,
    language: 'Python',
    status: 'completed',
    nextLesson: {
      id: '2',
      title: 'Variables & data types',
    },
    sections: [
      {
        id: 'sec-1-1',
        number: '01',
        title: 'What is Python?',
        paragraphs: [
          'Python is a general-purpose programming language created by Guido van Rossum and released in 1991. Its design philosophy puts readability first — Python code is meant to look almost like plain English, so you spend less time deciphering syntax and more time solving real problems.',
          'Because of that simplicity, Python has become one of the most popular languages on the planet. You will find it everywhere: data scientists use it to analyse millions of rows, web engineers build backends with it, game developers script logic in it, and AI researchers train models with it.',
          'Most importantly for you right now: Python is a fantastic first language. If you can describe an idea in plain words, you are already halfway to writing Python.',
        ],
        takeaway: {
          label: 'WHY PYTHON?',
          text: 'Easy to read, powerful enough for professionals, and in demand everywhere from startups to NASA.',
        },
      },
      {
        id: 'sec-1-2',
        number: '02',
        title: 'The print() function',
        paragraphs: [
          'The very first thing most programmers learn is how to make a program say something. In Python, you do that with the built-in print() function.',
          'A function is a reusable action with a name. You call it by writing its name followed by parentheses. Whatever you place inside the parentheses is called an argument — the value you hand to the function so it can do its job.',
          'Wrapping text in quotes (" " or \' \') tells Python you mean a literal piece of text, not a variable or command. That piece of text is called a string.',
        ],
        codeExample: {
          filename: 'hello.py',
          language: 'Python',
          code: `print("Hello, World!")`,
          caption: 'One function call. One string argument. One line of output.',
        },
      },
      {
        id: 'sec-1-3',
        number: '03',
        title: 'print() can do more than greet the world',
        paragraphs: [
          'You are not limited to one message per program. You can call print() as many times as you like — each call prints on its own line.',
          'You can also print numbers directly without quotes. Python knows 42 is a number, not text, so no quotes are needed.',
        ],
        codeExample: {
          filename: 'multiprint.py',
          language: 'Python',
          code: `print("I am learning Python!")
print("One line at a time.")
print(2025)`,
          caption: 'Three calls, three lines of output — in order, top to bottom.',
        },
        takeaway: {
          label: 'THE TAKEAWAY',
          text: 'Python runs your code line by line, from top to bottom. Each print() call adds one new line to the output.',
        },
      },
      {
        id: 'sec-1-4',
        number: '04',
        title: 'Your turn',
        paragraphs: [
          'Now it is your turn to write a real Python program. The editor below works exactly like a professional code editor — type your code and hit Run to see the output instantly.',
        ],
        challenge: {
          id: 'challenge-hello-world',
          title: 'Try it: say Hello World',
          description:
            'Use print() to display the message Hello World on the screen. Spelling and capitalisation must match exactly.',
          practiceLabel: 'PRACTICE 1 OF 1',
          filename: 'hello.py',
          language: 'Python 3',
          initialCode: `# Type your code below and click Run\n`,
          solutionCode: `print("Hello World")`,
          testCases: [
            {
              id: 'tc-hw-1',
              call: 'stdout',
              expected: 'Hello World',
            },
          ],
        },
      },
    ],
  },
  '4': {
    id: '4',
    lessonNumber: 4,
    moduleNumber: '02',
    moduleName: 'BUILDING BLOCKS',
    topic: 'Functions',
    title: 'Write once. Use it again.',
    description:
      'Learn how functions turn a set of instructions into reusable code. Then put your new skills to work with a quick challenge.',
    duration: '15 min lesson',
    exerciseCount: 2,
    language: 'Python',
    status: 'in_progress',
    prevLesson: {
      id: '3',
      title: 'Operators & expressions',
    },
    nextLesson: {
      id: '5',
      title: 'Scope & closures',
    },
    sections: [
      {
        id: 'sec-1',
        number: '01',
        title: 'Meet your first function',
        paragraphs: [
          'A function is a reusable block of code that performs a specific task. Give it a name, pass in some information, and let it do the work whenever you need it.',
        ],
        codeExample: {
          filename: 'greeting.py',
          language: 'Python',
          code: `def greet(name):
    return "Hello, " + name + "!"

greet("Ada")`,
          caption: 'A name is the input. A greeting is the output.',
        },
        challenge: {
          id: 'challenge-double',
          title: 'Your turn: double a number',
          description: 'Complete double(number) so it returns the number multiplied by 2.',
          practiceLabel: 'PRACTICE 1 OF 2',
          filename: 'main.py',
          language: 'Python 3',
          initialCode: `def double(number):
    # Write your code here
    pass`,
          solutionCode: `def double(number):
    return number * 2`,
          testCases: [
            {
              id: 'tc-1',
              call: 'double(4)',
              expected: '8',
            },
            {
              id: 'tc-2',
              call: 'double(-3)',
              expected: '-6',
            },
          ],
        },
      },
      {
        id: 'sec-2',
        number: '02',
        title: 'Make it your own',
        paragraphs: [
          'Parameters make functions flexible. Think of name as a placeholder: each time you call greet, you can pass in a different value.',
        ],
        takeaway: {
          label: 'THE TAKEAWAY',
          text: 'Define it once. Call it with different inputs. Get a new result.',
        },
      },
    ],
  },
}

// Fallback generator for other lessons to ensure full 12-lesson routing works
for (let i = 1; i <= 12; i++) {
  const idStr = String(i)
  if (!LESSON_DETAILS[idStr]) {
    // Find in course nav
    let lessonNav: CourseNavLesson | undefined
    let modName = 'GETTING STARTED'
    for (const mod of COURSE_NAV_DATA.modules) {
      const match = mod.lessons.find((l) => l.id === idStr)
      if (match) {
        lessonNav = match
        modName = mod.title
        break
      }
    }

    const title = lessonNav?.title || `Lesson ${idStr}`
    LESSON_DETAILS[idStr] = {
      id: idStr,
      lessonNumber: i,
      moduleNumber: i <= 3 ? '01' : i <= 7 ? '02' : '03',
      moduleName: modName,
      topic: title,
      title: `${title} in practice`,
      description: `Explore the fundamental concepts behind ${title.toLowerCase()} and build hands-on intuition with interactive code examples.`,
      duration: lessonNav?.duration || '12 min lesson',
      exerciseCount: 1,
      language: 'Python',
      status: lessonNav?.status || 'upcoming',
      prevLesson: i > 1 ? { id: String(i - 1), title: `Lesson ${String(i - 1).padStart(2, '0')}` } : undefined,
      nextLesson: i < 12 ? { id: String(i + 1), title: `Lesson ${String(i + 1).padStart(2, '0')}` } : undefined,
      sections: [
        {
          id: `sec-${idStr}-1`,
          number: '01',
          title: `Understanding ${title}`,
          paragraphs: [
            `In this lesson, we explore how ${title.toLowerCase()} functions in modern Python and why it is a critical building block for writing clean, efficient software.`,
          ],
          codeExample: {
            filename: 'example.py',
            language: 'Python',
            code: `# Exploring ${title}\nresult = "Ready to code!"\nprint(result)`,
            caption: 'Try running and experimenting with this example.',
          },
        },
        {
          id: `sec-${idStr}-2`,
          number: '02',
          title: 'Key Takeaways',
          paragraphs: [
            'Practice writing code frequently to build confidence and muscle memory with these patterns.',
          ],
          takeaway: {
            label: 'THE TAKEAWAY',
            text: 'Small, focused practice leads to deep programming intuition.',
          },
        },
      ],
    }
  }
}

// ----------------------------------------------------------------
// Initial Mock Conversation for the Lesson Assistant
// ----------------------------------------------------------------

export const INITIAL_ASSISTANT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    text: 'Why do we need return instead of print()?',
    timestamp: 'TODAY',
  },
  {
    id: 'msg-2',
    sender: 'assistant',
    title: 'Great question. They do different jobs.',
    paragraphs: [
      'return sends a value back so your program can use it. print() just displays a value for you to see.',
    ],
    comparison: {
      itemA: {
        label: 'return',
        description: 'Gives a result back to your program.',
      },
      itemB: {
        label: 'print()',
        description: 'Prints a message to the console.',
      },
    },
    analogy: {
      label: 'THINK OF IT THIS WAY',
      lines: [
        'A coffee machine returns your coffee.',
        'A screen that says "Coffee is ready" is more like print().',
        'Only one gives you something to use.',
      ],
    },
    closing: "Try spotting the value our function sends back. That's the value you can reuse.",
    timestamp: 'Just now',
    feedbackGiven: null,
  },
]

