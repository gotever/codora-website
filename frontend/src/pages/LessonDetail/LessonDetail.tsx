import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { CourseNavigation, LessonDetail as LessonDetailType } from '../../data/lessons'
import { fetchCourseLessons, fetchCourses, fetchLesson, personalizeLesson } from '../../lib/api'
import { buildCourseNavigation, parseLessonDetail, resolveLessonNavigation } from '../../lib/lessonContent'
import CourseSidebar from './components/CourseSidebar/CourseSidebar'
import LessonContent from './components/LessonContent/LessonContent'
import LessonAssistant from './components/LessonAssistant/LessonAssistant'
import './LessonDetail.css'

function getConsecutiveErrors() {
  try {
    const errors = Number(sessionStorage.getItem('codora:consecutive-errors') ?? 0)
    return Number.isFinite(errors) && errors > 0 ? Math.floor(errors) : 0
  } catch {
    return 0
  }
}

export default function LessonDetail() {
  const { id } = useParams<{ id: string }>()
  const [loadedLesson, setLoadedLesson] = useState<{
    requestedId: string
    lesson: LessonDetailType | null
    courseNav: CourseNavigation | null
    personalization: { adapted: boolean; level?: 'beginner' | 'intermediate' | 'advanced' }
    error: boolean
  } | null>(null)

  useEffect(() => {
    if (!id) return
    const lessonId = id
    let active = true

    async function loadLesson() {
      try {
        const record = await fetchLesson(lessonId)
        const [courses, courseLessons, personalization] = await Promise.all([
          fetchCourses(),
          fetchCourseLessons(record.course_id),
          personalizeLesson(record.id, getConsecutiveErrors())
            .then((value) => ({ value, adapted: true as const }))
            .catch(() => ({ value: null, adapted: false as const })),
        ])
        const contentMarkdown = personalization.value?.content_markdown ?? record.content_markdown
        const course = courses.find((item) => item.id === record.course_id)
        const parsedLesson = parseLessonDetail(contentMarkdown, record.id)
        const lesson = parsedLesson ? resolveLessonNavigation(parsedLesson, record, courseLessons) : null
        const courseNav = course ? buildCourseNavigation(course, courseLessons) : null

        if (active) {
          setLoadedLesson({
            requestedId: lessonId,
            lesson,
            courseNav,
            personalization: {
              adapted: personalization.adapted,
              level: personalization.value?.ability.level,
            },
            error: false,
          })
        }
      } catch {
        if (active) setLoadedLesson({ requestedId: lessonId, lesson: null, courseNav: null, personalization: { adapted: false }, error: true })
      }
    }

    void loadLesson()
    return () => { active = false }
  }, [id])

  // Mobile drawer states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [externalPrompt, setExternalPrompt] = useState<string | undefined>()

  // When user clicks "Ask AI for a hint ->" in the embedded challenge
  const handleAskAIHint = (challengeTitle: string) => {
    setExternalPrompt(`Give me a hint for: ${challengeTitle}`)
    setIsAssistantOpen(true)
  }

  if (!id || loadedLesson?.requestedId !== id) {
    return <main className="lesson-page-container" id="main-content" role="status">Loading lesson…</main>
  }

  const { lesson, courseNav, personalization, error } = loadedLesson
  if (error || !lesson || !courseNav) {
    return (
      <main className="lesson-page-container" id="main-content">
        <p role="alert">Could not load this lesson from the database. Check that the API is running and try again.</p>
      </main>
    )
  }

  return (
    <div className="lesson-page-container">
      {/* Mobile Top Bar with Drawer Toggles */}
      <div className="lesson-mobile-bar">
        <button
          type="button"
          className="lesson-mobile-bar__btn"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open course outline"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="16"
            height="16"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span>Outline</span>
        </button>

        <span className="lesson-mobile-bar__title">
          {lesson.topic}
        </span>

        <button
          type="button"
          className="lesson-mobile-bar__btn lesson-mobile-bar__btn--assistant"
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Open AI assistant"
        >
          <span className="lesson-mobile-bar__ai-icon">AI</span>
          <span>Assistant</span>
        </button>
      </div>

      {/* 3-Column Desktop Layout */}
      <div className="lesson-layout">
        {/* Left Column: Course Sidebar Navigation */}
        <CourseSidebar
          courseNav={courseNav}
          activeLessonId={lesson.id}
          isOpenOnMobile={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Center Column: Main Lesson Content Area */}
        <div className="lesson-center-column">
          <p className={`lesson-personalization-status${personalization.adapted ? ' lesson-personalization-status--adapted' : ''}`} role="status">
            {personalization.adapted
              ? `Lesson adapted for your ${personalization.level} level.`
              : 'Personalized lesson unavailable; showing the standard lesson.'}
          </p>
          <LessonContent
            lesson={lesson}
            onAskAIHint={handleAskAIHint}
          />
        </div>

        {/* Right Column: AI Lesson Assistant */}
        <LessonAssistant
          currentLessonTopic={lesson.topic}
          isOpenOnMobile={isAssistantOpen}
          onCloseMobile={() => setIsAssistantOpen(false)}
          externalPrompt={externalPrompt}
        />
      </div>

      {/* Floating trigger for assistant on tablet/mobile if closed */}
      <button
        type="button"
        className="lesson-floating-assistant-btn"
        onClick={() => setIsAssistantOpen(true)}
        aria-label="Ask Lesson Assistant"
      >
        <span className="lesson-floating-assistant-btn__icon">AI</span>
        <span className="lesson-floating-assistant-btn__text">Lesson Assistant</span>
      </button>
    </div>
  )
}

