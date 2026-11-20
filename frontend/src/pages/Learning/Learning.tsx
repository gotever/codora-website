import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import CourseCard from '../../components/CourseCard/CourseCard'
import type { Course } from '../../data/courses'
import { fetchCourseLessons, fetchCourses, fetchProgress } from '../../lib/api'
import { parseLessonDetail } from '../../lib/lessonContent'
import './Learning.css'

function BookIcon() {
  return (
    <svg
      className="learning-page__label-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export default function Learning() {
  const { user, loading: authLoading } = useAuth()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let active = true

    async function loadCurriculum() {
      try {
        const [records, progress] = await Promise.all([
          fetchCourses(),
          fetchProgress().catch(() => null),
        ])
        const completedLessonIds = new Set(
          progress?.filter((item) => item.item_type === 'lesson' && item.status === 'completed')
            .map((item) => String(item.item_id)) ?? [],
        )
        const coursesFromDatabase = await Promise.all(records.map(async (course) => {
          const lessons = await fetchCourseLessons(course.id)
          return {
            id: course.id,
            title: course.title,
            lessonCount: lessons.length,
            completedLessonCount: progress === null
              ? undefined
              : lessons.filter((lesson) => completedLessonIds.has(String(lesson.id))).length,
            paceLabel: course.order_index === 1 ? course.description : undefined,
            lessons: lessons.map((lesson) => {
              const detail = parseLessonDetail(lesson.content_markdown, lesson.id)
              return {
                id: lesson.id,
                number: detail?.lessonNumber,
                title: detail?.topic ?? lesson.title,
                description: detail?.description ?? '',
                completed: completedLessonIds.has(String(lesson.id)),
              }
            }),
          }
        }))

        if (active) setCourses(coursesFromDatabase)
      } catch {
        if (active) setError(true)
      }
    }

    void loadCurriculum()
    return () => { active = false }
  }, [authLoading, user?.id])

  return (
    <main className="learning-page" id="main-content">
      <div className="learning-page__content">
        {/* Page header */}
        <header className="learning-page__header">
          <div className="learning-page__label">
            <BookIcon />
            Learning
          </div>
          <h1 className="learning-page__title">Python lessons</h1>
          <p className="learning-page__subtitle">
            From your first line to functions. Explore Python, one bite-sized lesson at a time.
          </p>
        </header>

        {/* Course cards */}
        <div className="learning-page__courses">
          {courses === null && !error && <p role="status">Loading courses…</p>}
          {error && <p role="alert">Could not load courses from the database. Check that the API is running and try again.</p>}
          {courses?.length === 0 && <p>No courses are available in the database yet.</p>}
          {courses?.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      </div>
    </main>
  )
}
