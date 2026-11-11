// ============================================================
// Mock data for the Exercises pages — Codora
// ============================================================

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface TestCase {
  id: string
  label: string
  input: string
  inputLabel: string
  expectedOutput: string
  explanation?: string
  /** Python expression for the argument(s) to pass to the function under test */
  argsExpression: string
}

export interface HintLevel {
  level: 1 | 2 | 3
  label: string
  sublabel: string
  content: string
}

export interface Exercise {
  id: number | string
  number: number
  total: number
  title: string
  difficulty: Difficulty
  tags: string[]
  description: string
  functionSignature: string
  /** The Python function name that students must implement */
  functionName: string
  inputDescription?: string
  outputDescription?: string
  examples: {
    id: number
    input: string
    output: string
    explanation?: string
  }[]
  constraints: string[]
  hints: HintLevel[]
  relatedLesson?: {
    label: string
    to: string
  }
  initialCode: string
  filename: string
  courseId: string
  courseTitle: string
}

export interface ExerciseListItem {
  id: number | string
  number: number
  title: string
  difficulty: Difficulty
  tags: string[]
  courseId: string
  courseTitle: string
}

// ----------------------------------------------------------------
// Mock exercises
// ----------------------------------------------------------------

export const EXERCISES: Exercise[] = [
  {
    id: 'sum-of-even-numbers',
    number: 4,
    total: 12,
    title: 'Sum of even numbers',
    difficulty: 'Easy',
    tags: ['Lists', 'Loops', 'Conditionals'],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: 'sum_even.py',
    functionName: 'sum_even',
    description:
      'Given a list of integers <code>numbers</code>, return the sum of all even numbers in the list. An even number is divisible by 2 with no remainder.',
    functionSignature: 'sum_even(numbers)',
    inputDescription: 'A list of integers.',
    outputDescription: 'An integer — the sum of all even numbers in the list.',
    examples: [
      {
        id: 1,
        input: 'numbers = [1, 2, 3, 4, 5, 6]',
        output: '12',
        explanation: 'The even numbers are 2, 4, and 6. Their sum is 12.',
      },
      {
        id: 2,
        input: 'numbers = [1, 3, 5]',
        output: '0',
        explanation: 'There are no even numbers, so the result is 0.',
      },
    ],
    constraints: [
      '0 ≤ len(numbers) ≤ 1,000',
      '-1,000 ≤ numbers[i] ≤ 1,000',
    ],
    hints: [
      {
        level: 1,
        label: 'A Little Nudge',
        sublabel: 'Think about how to check if a number is even.',
        content:
          'An even number leaves no remainder when divided by 2. In Python, you can check this with the modulo operator: <code>number % 2 == 0</code>. How might you use this check as you go through the list?',
      },
      {
        level: 2,
        label: 'Guide Me Further',
        sublabel: 'Think about which tools to use.',
        content:
          'Consider using a <strong>for loop</strong> to iterate over each element in the list. Keep a running total (a variable that starts at 0 and grows). Inside the loop, only add to the total when the number is even. This is a classic accumulator pattern.',
      },
      {
        level: 3,
        label: 'Show Me the Approach',
        sublabel: 'Here\'s a step-by-step walkthrough.',
        content: `Here's pseudocode for one clean approach:

<pre>function sum_even(numbers):
    total = 0
    for each number in numbers:
        if number % 2 == 0:
            total = total + number
    return total</pre>

You initialise a <code>total</code> variable to 0, loop through every element, and only add it when it passes the even-number check. No external libraries needed — just a loop, a condition, and an accumulator.`,
      },
    ],
    relatedLesson: {
      label: 'Repeating with loops',
      to: '/learning',
    },
    initialCode: `def sum_even(numbers):
    """Return the sum of all even numbers."""

    # Write your solution here
    pass


# Try your code with the test cases below.
# Use return, not print, for your answer.
`,
  },
  {
    id: 'reverse-a-string',
    number: 1,
    total: 12,
    title: 'Reverse a string',
    difficulty: 'Easy',
    tags: ['Strings', 'Loops'],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: 'reverse_string.py',
    functionName: 'reverse_string',
    description:
      'Given a string <code>s</code>, return it reversed.',
    functionSignature: 'reverse_string(s)',
    examples: [
      {
        id: 1,
        input: 's = "hello"',
        output: '"olleh"',
      },
      {
        id: 2,
        input: 's = "Python"',
        output: '"nohtyP"',
      },
    ],
    constraints: ['0 ≤ len(s) ≤ 10,000'],
    hints: [
      {
        level: 1,
        label: 'A Little Nudge',
        sublabel: 'Think about reading backwards.',
        content:
          'What if you built the result one character at a time, starting from the end of the string? In Python, you can access individual characters with their index.',
      },
      {
        level: 2,
        label: 'Guide Me Further',
        sublabel: 'Consider Python\'s slicing syntax.',
        content:
          'Python strings support slicing with a step argument. The notation <code>s[start:stop:step]</code> lets you control direction. What step value would read a string backwards?',
      },
      {
        level: 3,
        label: 'Show Me the Approach',
        sublabel: 'Here\'s the simplest solution.',
        content: `Python's slice notation makes this a one-liner:

<pre>def reverse_string(s):
    return s[::-1]</pre>

<code>s[::-1]</code> starts at the end, moves to the beginning, one character at a time — returning the reversed string.`,
      },
    ],
    initialCode: `def reverse_string(s):
    """Return the reversed version of s."""

    # Write your solution here
    pass
`,
  },
  {
    id: 'count-vowels',
    number: 2,
    total: 12,
    title: 'Count vowels',
    difficulty: 'Easy',
    tags: ['Strings', 'Loops', 'Conditionals'],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: 'count_vowels.py',
    functionName: 'count_vowels',
    description:
      'Given a string <code>s</code>, return the number of vowels (a, e, i, o, u) in the string. Treat uppercase and lowercase letters the same.',
    functionSignature: 'count_vowels(s)',
    examples: [
      {
        id: 1,
        input: 's = "Hello World"',
        output: '3',
        explanation: 'The vowels are e, o, o.',
      },
      {
        id: 2,
        input: 's = "Python"',
        output: '1',
        explanation: 'The only vowel is o.',
      },
    ],
    constraints: ['0 ≤ len(s) ≤ 10,000'],
    hints: [
      {
        level: 1,
        label: 'A Little Nudge',
        sublabel: 'Think about membership testing.',
        content:
          'You need to check each character in the string. How can you tell if a character is a vowel? Consider keeping a list (or string) of all vowels and checking if the character is in it.',
      },
      {
        level: 2,
        label: 'Guide Me Further',
        sublabel: 'Consider case-insensitive comparison.',
        content:
          'Convert the whole string (or each character) to lowercase before checking. That way "A" and "a" are treated the same. The <code>in</code> operator checks membership: <code>"a" in "aeiou"</code> returns <code>True</code>.',
      },
      {
        level: 3,
        label: 'Show Me the Approach',
        sublabel: 'Here\'s one clean approach.',
        content: `<pre>def count_vowels(s):
    count = 0
    for char in s.lower():
        if char in "aeiou":
            count += 1
    return count</pre>

You can also do this in one line with a generator expression: <code>sum(1 for c in s.lower() if c in "aeiou")</code>.`,
      },
    ],
    initialCode: `def count_vowels(s):
    """Return the number of vowels in s."""

    # Write your solution here
    pass
`,
  },
  {
    id: 'find-maximum',
    number: 3,
    total: 12,
    title: 'Find maximum',
    difficulty: 'Easy',
    tags: ['Lists', 'Loops'],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: 'find_maximum.py',
    functionName: 'find_maximum',
    description:
      'Given a non-empty list of integers <code>numbers</code>, return the largest number in the list without using the built-in <code>max()</code> function.',
    functionSignature: 'find_maximum(numbers)',
    examples: [
      {
        id: 1,
        input: 'numbers = [3, 1, 7, 2, 5]',
        output: '7',
      },
      {
        id: 2,
        input: 'numbers = [-5, -1, -3]',
        output: '-1',
      },
    ],
    constraints: [
      '1 ≤ len(numbers) ≤ 10,000',
      '-10,000 ≤ numbers[i] ≤ 10,000',
    ],
    hints: [
      {
        level: 1,
        label: 'A Little Nudge',
        sublabel: 'Think about how you\'d do this by hand.',
        content:
          'If you were scanning a list of numbers by hand, you\'d probably keep track of the biggest one you\'ve seen so far. How could you replicate that in code?',
      },
      {
        level: 2,
        label: 'Guide Me Further',
        sublabel: 'Think about initialisation.',
        content:
          'Start with <code>current_max</code> set to the first element. Then loop through the rest. If you find something bigger, update <code>current_max</code>. What should happen at the end of the loop?',
      },
      {
        level: 3,
        label: 'Show Me the Approach',
        sublabel: 'Here\'s the step-by-step.',
        content: `<pre>def find_maximum(numbers):
    current_max = numbers[0]
    for num in numbers[1:]:
        if num > current_max:
            current_max = num
    return current_max</pre>

Starting with the first element avoids issues with negative numbers (unlike starting with 0).`,
      },
    ],
    initialCode: `def find_maximum(numbers):
    """Return the largest number in the list (without using max())."""

    # Write your solution here
    pass
`,
  },
]

// ----------------------------------------------------------------
// Exercise list (lighter objects, for the list page)
// ----------------------------------------------------------------

export const EXERCISE_LIST: ExerciseListItem[] = EXERCISES.map((e) => ({
  id: e.id,
  number: e.number,
  title: e.title,
  difficulty: e.difficulty,
  tags: e.tags,
  courseId: e.courseId,
  courseTitle: e.courseTitle,
}))

// ----------------------------------------------------------------
// Test cases per exercise id — with argsExpression for Pyodide runner
// ----------------------------------------------------------------

export const TEST_CASES: Record<string, TestCase[]> = {
  'sum-of-even-numbers': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 'numbers =',
      input: '[1, 2, 3, 4, 5, 6]',
      expectedOutput: '12',
      explanation: 'The even numbers are 2, 4, and 6. Their sum is 12.',
      argsExpression: '([1, 2, 3, 4, 5, 6],)',
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 'numbers =',
      input: '[1, 3, 5]',
      expectedOutput: '0',
      explanation: 'There are no even numbers, so the result is 0.',
      argsExpression: '([1, 3, 5],)',
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 'numbers =',
      input: '[]',
      expectedOutput: '0',
      explanation: 'An empty list has no even numbers.',
      argsExpression: '([],)',
    },
  ],
  'reverse-a-string': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 's =',
      input: '"hello"',
      expectedOutput: "'olleh'",
      argsExpression: '("hello",)',
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 's =',
      input: '"Python"',
      expectedOutput: "'nohtyP'",
      argsExpression: '("Python",)',
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 's =',
      input: '""',
      expectedOutput: "''",
      argsExpression: '("",)',
    },
  ],
  'count-vowels': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 's =',
      input: '"Hello World"',
      expectedOutput: '3',
      argsExpression: '("Hello World",)',
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 's =',
      input: '"Python"',
      expectedOutput: '1',
      argsExpression: '("Python",)',
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 's =',
      input: '"aeiou"',
      expectedOutput: '5',
      argsExpression: '("aeiou",)',
    },
  ],
  'find-maximum': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 'numbers =',
      input: '[3, 1, 7, 2, 5]',
      expectedOutput: '7',
      argsExpression: '([3, 1, 7, 2, 5],)',
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 'numbers =',
      input: '[-5, -1, -3]',
      expectedOutput: '-1',
      argsExpression: '([-5, -1, -3],)',
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 'numbers =',
      input: '[42]',
      expectedOutput: '42',
      argsExpression: '([42],)',
    },
  ],
}
