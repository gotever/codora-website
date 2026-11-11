import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { COURSE_NAV_DATA, LESSON_DETAILS } from '../../frontend/src/data/lessons.ts'
import { COURSES } from '../../frontend/src/data/courses.ts'
import { EXERCISES, TEST_CASES } from '../../frontend/src/data/exercises.ts'

const target = resolve(import.meta.dirname, '../data/curriculum.json')
await mkdir(resolve(import.meta.dirname, '../data'), { recursive: true })
await writeFile(target, JSON.stringify({ courses: COURSES, courseNavigation: COURSE_NAV_DATA,
  lessons: LESSON_DETAILS, exercises: EXERCISES, testCases: TEST_CASES }, null, 2) + '\n')
console.log(`Exported source curriculum to ${target}`)
