// ============================================================
// Mock data for the Exercises pages — Codora
// ============================================================

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface TestCase {
  id: string
  label: string
  input: string
  inputLabel: string
  inputs?: { label: string; value: string }[]
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
  {
    id: 'is-palindrome',
    number: 5,
    total: 12,
    title: 'Check palindrome',
    difficulty: 'Easy',
    tags: ['Strings', 'Basics'],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: 'is_palindrome.py',
    functionName: 'is_palindrome',
    description:
      'Given a string <code>s</code>, write a function that returns <code>True</code> if <code>s</code> reads the same backwards and forwards (a palindrome), or <code>False</code> otherwise.',
    functionSignature: 'is_palindrome(s)',
    inputDescription: 'A string s containing lowercase English letters.',
    outputDescription: 'A boolean: True if s is a palindrome, False otherwise.',
    examples: [
      {
        id: 1,
        input: 's = "radar"',
        output: 'True',
        explanation: '"radar" reversed is still "radar".',
      },
      {
        id: 2,
        input: 's = "hello"',
        output: 'False',
        explanation: '"hello" reversed is "olleh", so it is not a palindrome.',
      },
    ],
    constraints: [
      '1 ≤ len(s) ≤ 10,000',
      's consists only of lowercase English letters.',
    ],
    hints: [
      {
        level: 1,
        label: 'A Little Nudge',
        sublabel: 'Think about reversing the string.',
        content:
          'A palindrome is identical forwards and backwards. What happens if you compare the original string with its reverse?',
      },
      {
        level: 2,
        label: 'Guide Me Further',
        sublabel: 'Python string slicing trick.',
        content:
          'Python strings support slicing with a step. Did you know <code>s[::-1]</code> produces a reversed copy of string <code>s</code>?',
      },
      {
        level: 3,
        label: 'Show Me the Approach',
        sublabel: 'Step-by-step solution.',
        content: `<pre>def is_palindrome(s):
    return s == s[::-1]</pre>

Comparing <code>s</code> with <code>s[::-1]</code> directly returns <code>True</code> or <code>False</code>.`,
      },
    ],
    initialCode: `def is_palindrome(s):
    """Return True if s is a palindrome, False otherwise."""

    # Write your solution here
    pass
`,
  },
  {
    id: "is-even-number",
    number: 6,
    total: 10,
    title: "Check if a number is even",
    difficulty: "Easy",
    tags: ["Numbers", "Operators", "Conditionals"],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: "is_even.py",
    functionName: "is_even",
    description: "Given an integer <code>number</code>, return <code>True</code> if it is even and <code>False</code> otherwise.",
    functionSignature: "is_even(number)",
    inputDescription: "An integer number.",
    outputDescription: "A Boolean indicating whether number is even.",
    examples: [
      { id: 1, input: "number = 8", output: "True", explanation: "8 is divisible by 2." },
      { id: 2, input: "number = 7", output: "False", explanation: "7 leaves a remainder when divided by 2." },
    ],
    constraints: ["-1,000,000,000 ≤ number ≤ 1,000,000,000"],
    hints: [
      { level: 1, label: "A Little Nudge", sublabel: "Look at the remainder after division by 2.", content: "What expression gives the remainder when number is divided by 2?" },
      { level: 2, label: "Guide Me Further", sublabel: "Use the comparison result directly.", content: "The comparison <code>number % 2 == 0</code> is already a Boolean." },
      { level: 3, label: "Show Me the Approach", sublabel: "Return the parity check.", content: "Use modulo to check divisibility by 2, then return that Boolean value." },
    ],
    relatedLesson: { label: "Lesson 4", to: '/learning' },
    initialCode: "def is_even(number):\n    \"\"\"Return True when number is even.\"\"\"\n\n    # Write your solution here\n    pass\n",
  },
  {
    id: "rectangle-area",
    number: 7,
    total: 10,
    title: "Calculate rectangle area",
    difficulty: "Easy",
    tags: ["Numbers", "Operators", "Functions"],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: "rectangle_area.py",
    functionName: "rectangle_area",
    description: "Given a rectangle's <code>width</code> and <code>height</code>, return its area.",
    functionSignature: "rectangle_area(width, height)",
    inputDescription: "Two non-negative numeric values: width and height.",
    outputDescription: "The rectangle area, calculated as width multiplied by height.",
    examples: [
      { id: 1, input: "width = 5, height = 3", output: "15", explanation: "Area is width multiplied by height." },
      { id: 2, input: "width = 4, height = 4", output: "16", explanation: "A square uses the same formula." },
    ],
    constraints: ["0 ≤ width ≤ 10,000", "0 ≤ height ≤ 10,000"],
    hints: [
      { level: 1, label: "A Little Nudge", sublabel: "Recall the rectangle area formula.", content: "Which operation combines width and height to calculate area?" },
      { level: 2, label: "Guide Me Further", sublabel: "Use both parameters.", content: "Multiply the two values supplied to the function." },
      { level: 3, label: "Show Me the Approach", sublabel: "Return the product.", content: "The area is <code>width * height</code>." },
    ],
    relatedLesson: { label: "Lesson 4", to: '/learning' },
    initialCode: "def rectangle_area(width, height):\n    \"\"\"Return the area of a rectangle.\"\"\"\n\n    # Write your solution here\n    pass\n",
  },
  {
    id: "count-words",
    number: 8,
    total: 10,
    title: "Count words in a string",
    difficulty: "Medium",
    tags: ["Strings", "Loops", "Conditionals"],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: "count_words.py",
    functionName: "count_words",
    description: "Given a string <code>s</code>, return the number of words. Words are non-empty sequences separated by whitespace.",
    functionSignature: "count_words(s)",
    inputDescription: "A string that may contain words and whitespace.",
    outputDescription: "The number of whitespace-separated words.",
    examples: [
      { id: 1, input: "s = \"hello world\"", output: "2", explanation: "There are two whitespace-separated words." },
      { id: 2, input: "s = \"  one   two  \"", output: "2", explanation: "Extra whitespace does not create empty words." },
    ],
    constraints: ["0 ≤ len(s) ≤ 10,000"],
    hints: [
      { level: 1, label: "A Little Nudge", sublabel: "Think about what separates words.", content: "Whitespace can include spaces, tabs, and newlines." },
      { level: 2, label: "Guide Me Further", sublabel: "Use Python string tools carefully.", content: "The <code>split()</code> method separates a string on runs of whitespace." },
      { level: 3, label: "Show Me the Approach", sublabel: "Count the resulting words.", content: "The number of items in <code>s.split()</code> is the word count, including 0 for whitespace-only input." },
    ],
    relatedLesson: { label: "Lesson 6", to: '/learning' },
    initialCode: "def count_words(s):\n    \"\"\"Return the number of whitespace-separated words in s.\"\"\"\n\n    # Write your solution here\n    pass\n",
  },
  {
    id: "find-second-largest",
    number: 9,
    total: 10,
    title: "Find the second largest distinct number",
    difficulty: "Medium",
    tags: ["Lists", "Loops", "Conditionals"],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: "find_second_largest.py",
    functionName: "find_second_largest",
    description: "Given a list of integers, return the second largest distinct value. If the list has fewer than two distinct values, return <code>None</code>.",
    functionSignature: "find_second_largest(numbers)",
    inputDescription: "A list of integers; it may be empty or contain duplicates.",
    outputDescription: "The second largest distinct integer, or None when it does not exist.",
    examples: [
      { id: 1, input: "numbers = [3, 1, 7, 2, 5]", output: "5", explanation: "The largest value is 7 and the second largest distinct value is 5." },
      { id: 2, input: "numbers = [5, 5, 3]", output: "3", explanation: "Duplicate maximum values count once." },
    ],
    constraints: ["0 ≤ len(numbers) ≤ 10,000", "-1,000,000 ≤ numbers[i] ≤ 1,000,000"],
    hints: [
      { level: 1, label: "A Little Nudge", sublabel: "Keep track of two values.", content: "As you scan the list, track the largest and second largest distinct values seen so far." },
      { level: 2, label: "Guide Me Further", sublabel: "Handle duplicates separately.", content: "A value equal to the current largest should not become the second largest." },
      { level: 3, label: "Show Me the Approach", sublabel: "Consider the case where no answer exists.", content: "If fewer than two distinct values appear, return <code>None</code>; otherwise return the second distinct maximum." },
    ],
    relatedLesson: { label: "Lesson 6", to: '/learning' },
    initialCode: "def find_second_largest(numbers):\n    \"\"\"Return the second largest distinct value, or None.\"\"\"\n\n    # Write your solution here\n    pass\n",
  },
  {
    id: "sum-digits-recursively",
    number: 10,
    total: 10,
    title: "Sum digits recursively",
    difficulty: "Medium",
    tags: ["Recursion", "Numbers", "Functions"],
    courseId: 'python-fundamentals',
    courseTitle: 'Python fundamentals',
    filename: "sum_digits.py",
    functionName: "sum_digits",
    description: "Given a non-negative integer <code>number</code>, return the sum of its digits using recursion.",
    functionSignature: "sum_digits(number)",
    inputDescription: "A non-negative integer.",
    outputDescription: "The sum of all decimal digits in number.",
    examples: [
      { id: 1, input: "number = 123", output: "6", explanation: "1 + 2 + 3 equals 6." },
      { id: 2, input: "number = 908", output: "17", explanation: "9 + 0 + 8 equals 17." },
    ],
    constraints: ["0 ≤ number ≤ 999,999,999"],
    hints: [
      { level: 1, label: "A Little Nudge", sublabel: "Identify the recursive base case.", content: "A one-digit number can be returned as its own digit sum." },
      { level: 2, label: "Guide Me Further", sublabel: "Split off the last digit.", content: "Use <code>number % 10</code> for the last digit and <code>number // 10</code> for the remaining digits." },
      { level: 3, label: "Show Me the Approach", sublabel: "Combine the digit with a smaller problem.", content: "For numbers with at least two digits, add the last digit to a recursive call on <code>number // 10</code>." },
    ],
    relatedLesson: { label: "Lesson 9", to: '/learning' },
    initialCode: "def sum_digits(number):\n    \"\"\"Return the sum of digits using recursion.\"\"\"\n\n    # Write your solution here\n    pass\n",
  },

]

EXERCISES.sort((left, right) => left.number - right.number)

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
      input: "[1, 2, 3, 4, 5, 6]",
      expectedOutput: '12',
      argsExpression: "([1, 2, 3, 4, 5, 6],)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 'numbers =',
      input: "[1, 3, 5]",
      expectedOutput: '0',
      argsExpression: "([1, 3, 5],)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 'numbers =',
      input: "[2, 4, 6]",
      expectedOutput: '12',
      argsExpression: "([2, 4, 6],)",
    },
  ],
  'reverse-a-string': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 's =',
      input: "\"hello\"",
      expectedOutput: "'olleh'",
      argsExpression: "(\"hello\",)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 's =',
      input: "\"Python\"",
      expectedOutput: "'nohtyP'",
      argsExpression: "(\"Python\",)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 's =',
      input: "\"OpenAI\"",
      expectedOutput: "'IAnepO'",
      argsExpression: "(\"OpenAI\",)",
    },
  ],
  'count-vowels': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 's =',
      input: "\"Hello World\"",
      expectedOutput: '3',
      argsExpression: "(\"Hello World\",)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 's =',
      input: "\"Python\"",
      expectedOutput: '1',
      argsExpression: "(\"Python\",)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 's =',
      input: "\"aeiou\"",
      expectedOutput: '5',
      argsExpression: "(\"aeiou\",)",
    },
  ],
  'find-maximum': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 'numbers =',
      input: "[3, 1, 7, 2, 5]",
      expectedOutput: '7',
      argsExpression: "([3, 1, 7, 2, 5],)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 'numbers =',
      input: "[-5, -1, -3]",
      expectedOutput: '-1',
      argsExpression: "([-5, -1, -3],)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 'numbers =',
      input: "[1, 9, 3]",
      expectedOutput: '9',
      argsExpression: "([1, 9, 3],)",
    },
  ],
  'is-palindrome': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: 's =',
      input: "\"radar\"",
      expectedOutput: 'True',
      argsExpression: "(\"radar\",)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: 's =',
      input: "\"hello\"",
      expectedOutput: 'False',
      argsExpression: "(\"hello\",)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: 's =',
      input: "\"level\"",
      expectedOutput: 'True',
      argsExpression: "(\"level\",)",
    },
  ],
  'is-even-number': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: "number =",
      input: "number = 8",
      expectedOutput: "True",
      argsExpression: "(8,)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: "number =",
      input: "number = 7",
      expectedOutput: "False",
      argsExpression: "(7,)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: "number =",
      input: "number = -4",
      expectedOutput: "True",
      argsExpression: "(-4,)",
    },
  ],
  'rectangle-area': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: "width =, height =",
      input: "width = 5, height = 3",
      expectedOutput: "15",
      argsExpression: "(5, 3)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: "width =, height =",
      input: "width = 10, height = 2",
      expectedOutput: "20",
      argsExpression: "(10, 2)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: "width =, height =",
      input: "width = 4, height = 4",
      expectedOutput: "16",
      argsExpression: "(4, 4)",
    },
  ],
  'count-words': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: "s =",
      input: "s = \"hello world\"",
      expectedOutput: "2",
      argsExpression: "(\"hello world\",)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: "s =",
      input: "s = \"Python\"",
      expectedOutput: "1",
      argsExpression: "(\"Python\",)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: "s =",
      input: "s = \"one two three\"",
      expectedOutput: "3",
      argsExpression: "(\"one two three\",)",
    },
  ],
  'find-second-largest': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: "numbers =",
      input: "numbers = [3, 1, 7, 2, 5]",
      expectedOutput: "5",
      argsExpression: "([3, 1, 7, 2, 5],)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: "numbers =",
      input: "numbers = [9, 4, 7]",
      expectedOutput: "7",
      argsExpression: "([9, 4, 7],)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: "numbers =",
      input: "numbers = [5, 5, 3]",
      expectedOutput: "3",
      argsExpression: "([5, 5, 3],)",
    },
  ],
  'sum-digits-recursively': [
    {
      id: 'case-1',
      label: 'Case 1',
      inputLabel: "number =",
      input: "number = 0",
      expectedOutput: "0",
      argsExpression: "(0,)",
    },
    {
      id: 'case-2',
      label: 'Case 2',
      inputLabel: "number =",
      input: "number = 123",
      expectedOutput: "6",
      argsExpression: "(123,)",
    },
    {
      id: 'case-3',
      label: 'Case 3',
      inputLabel: "number =",
      input: "number = 908",
      expectedOutput: "17",
      argsExpression: "(908,)",
    },
  ],

}
