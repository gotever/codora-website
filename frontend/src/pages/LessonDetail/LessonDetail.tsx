import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type { CourseNavigation, LessonChallengeContext, LessonDetail as LessonDetailType } from '../../data/lessons'
import { ApiError, fetchCourseLessons, fetchCourses, fetchLesson, fetchLessonChallengeProgress, fetchProgress, personalizeLesson, saveProgress, type ApiCourse, type ApiLesson, type ApiPersonalizedLesson } from '../../lib/api'
import { buildCourseNavigation, parseLessonDetail, resolveLessonNavigation } from '../../lib/lessonContent'
import CourseSidebar from './components/CourseSidebar/CourseSidebar'
import LessonContent from './components/LessonContent/LessonContent'
import LessonAssistant from './components/LessonAssistant/LessonAssistant'
import './LessonDetail.css'

const LESSON_CACHE_VERSION = 2
const personalizationRequests = new Map<string, Promise<ApiPersonalizedLesson | null>>()

interface CachedLessonPage {
  lesson: ApiLesson
  course: ApiCourse
  courseLessons: ApiLesson[]
  contentMarkdown: string
  adapted: boolean
  level?: 'beginner' | 'intermediate' | 'advanced'
}

function getLessonCacheKey(lessonId: string, userId?: string) {
  return `codora:lesson-page:v${LESSON_CACHE_VERSION}:${userId ?? 'guest'}:${lessonId}`
}

function readLessonCache(lessonId: string, userId?: string): CachedLessonPage | null {
  try {
    const raw = localStorage.getItem(getLessonCacheKey(lessonId, userId))
    if (!raw) return null
    const cached: unknown = JSON.parse(raw)
    if (!cached || typeof cached !== 'object') return null
    const value = cached as CachedLessonPage
    return value.lesson && value.course && Array.isArray(value.courseLessons) && typeof value.contentMarkdown === 'string'
      ? value
      : null
  } catch {
    return null
  }
}

function writeLessonCache(lessonId: string, userId: string | undefined, value: CachedLessonPage) {
  try {
    localStorage.setItem(getLessonCacheKey(lessonId, userId), JSON.stringify(value))
  } catch {
    // Keep lesson loading functional when browser storage is unavailable or full.
  }
}

function personalizeLessonOnce(lessonId: string | number, userId?: string) {
  const key = getLessonCacheKey(String(lessonId), userId)
  const existing = personalizationRequests.get(key)
  if (existing) return existing

  const request = personalizeLesson(lessonId, getConsecutiveErrors()).catch(() => null)
  personalizationRequests.set(key, request)
  return request
}

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
  const { user, refresh, loading: authLoading } = useAuth()
  const [loadedLesson, setLoadedLesson] = useState<{
    requestedId: string
    lesson: LessonDetailType | null
    courseNav: CourseNavigation | null
    completedChallengeIds: string[]
    personalization: { adapted: boolean; level?: 'beginner' | 'intermediate' | 'advanced' }
    error: boolean
  } | null>(null)
  const [personalizingLessonId, setPersonalizingLessonId] = useState<string | null>(null)

  useEffect(() => {
    if (!id || authLoading) return
    const lessonId = id
    setChallengeContext(undefined)
    const cachedPage = readLessonCache(lessonId, user?.id)
    let active = true

    async function loadLesson() {
      try {
        const record = cachedPage?.lesson ?? await fetchLesson(lessonId)
        if (!cachedPage && active) setPersonalizingLessonId(lessonId)
        const [course, courseLessons, progress, completedChallengeIds, personalization] = await Promise.all([
          cachedPage ? Promise.resolve(cachedPage.course) : fetchCourses().then((items) => items.find((item) => item.id === record.course_id) ?? null),
          cachedPage ? Promise.resolve(cachedPage.courseLessons) : fetchCourseLessons(record.course_id),
          fetchProgress().catch(() => []),
          fetchLessonChallengeProgress(record.id).catch(() => []),
          cachedPage
            ? Promise.resolve(null)
            : personalizeLessonOnce(record.id, user?.id).then((value) => ({ value, adapted: value !== null })),
        ])
        if (!course) throw new Error('Course not found')
        const contentMarkdown = cachedPage?.contentMarkdown ?? personalization?.value?.content_markdown ?? record.content_markdown
        const adapted = cachedPage?.adapted ?? personalization?.adapted ?? false
        const level = cachedPage?.level ?? personalization?.value?.ability.level
        if (!cachedPage) {
          writeLessonCache(lessonId, user?.id, {
            lesson: record,
            course,
            courseLessons,
            contentMarkdown,
            adapted,
            level,
          })
        }
        const parsedLesson = parseLessonDetail(contentMarkdown, record.id)
        const lesson = parsedLesson ? resolveLessonNavigation(parsedLesson, record, courseLessons) : null
        const courseNav = buildCourseNavigation(course, courseLessons, progress, record.id)

        if (active) {
          setPersonalizingLessonId(null)
          setLoadedLesson({
            requestedId: lessonId,
            lesson,
            courseNav,
            completedChallengeIds,
            personalization: {
              adapted,
              level,
            },
            error: false,
          })
        }
      } catch {
        if (active) {
          setPersonalizingLessonId(null)
          setLoadedLesson({ requestedId: lessonId, lesson: null, courseNav: null, completedChallengeIds: [], personalization: { adapted: false }, error: true })
        }
      }
    }

    void loadLesson()
    return () => { active = false }
  }, [id, authLoading, user?.id])

  // Mobile drawer states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [externalPrompt, setExternalPrompt] = useState<string | undefined>()
  const [challengeContext, setChallengeContext] = useState<LessonChallengeContext | undefined>()
  const [completionNotice, setCompletionNotice] = useState<{
    lessonId: string
    status: 'saving' | 'completed' | 'auth_required' | 'error'
  } | null>(null)

  // When user clicks "Ask AI for a hint ->" in the embedded challenge
  const handleAskAIHint = (context: LessonChallengeContext) => {
    setChallengeContext(context)
    setExternalPrompt(`Give me a hint for: ${context.title}`)
    setIsAssistantOpen(true)
  }

  if (!id || loadedLesson?.requestedId !== id) {
    const isPersonalizing = personalizingLessonId === id
    return (
      <main
        className="lesson-loading"
        id="main-content"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="lesson-loading__content">
          <span className="lesson-loading__spinner" aria-hidden="true" />
          <div className="lesson-loading__copy">
            <p className="lesson-loading__eyebrow">{isPersonalizing ? 'AI PERSONALIZATION' : 'LESSON'}</p>
            <p className="lesson-loading__title">
              {isPersonalizing ? 'AI is personalizing your lesson' : 'Loading lesson…'}
            </p>
            {isPersonalizing && (
              <p className="lesson-loading__description">
                Adapting explanations and examples to your learning profile. This may take a moment.
              </p>
            )}
          </div>
          {isPersonalizing && <span className="lesson-loading__progress" aria-hidden="true" />}
        </div>
      </main>
    )
  }

  const { lesson, courseNav, personalization, error } = loadedLesson
  if (error || !lesson || !courseNav) {
    return (
      <main className="lesson-page-container" id="main-content">
        <p role="alert">Could not load this lesson from the database. Check that the API is running and try again.</p>
      </main>
    )
  }

  const handleAllChallengesPassed = async () => {
    const lessonId = String(lesson.id)
    setCompletionNotice({ lessonId, status: 'saving' })
    try {
      await saveProgress(Number(lesson.id), 'lesson', 'completed')
      if (user) await refresh()
      setCompletionNotice({ lessonId, status: 'completed' })
      setLoadedLesson((current) => {
        if (!current || current.requestedId !== lessonId || !current.courseNav) return current

        const wasCompleted = current.courseNav.modules.some((module) =>
          module.lessons.some((item) => item.id === lessonId && item.status === 'completed'),
        )
        return {
          ...current,
          courseNav: {
            ...current.courseNav,
            completedLessons: current.courseNav.completedLessons + (wasCompleted ? 0 : 1),
            modules: current.courseNav.modules.map((module) => ({
              ...module,
              lessons: module.lessons.map((item) => item.id === lessonId ? { ...item, status: 'completed' } : item),
            })),
          },
        }
      })
      return true
    } catch (error) {
      setCompletionNotice({ lessonId, status: error instanceof ApiError && error.status === 401 ? 'auth_required' : 'error' })
      return false
    }
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
            key={lesson.id}
            lesson={lesson}
            completedChallengeIds={loadedLesson.completedChallengeIds}
            userId={user?.id}
            onAskAIHint={handleAskAIHint}
            onChallengeContextChange={setChallengeContext}
            onAllChallengesPassed={handleAllChallengesPassed}
            completionStatus={completionNotice?.lessonId === String(lesson.id) ? completionNotice.status : undefined}
          />
        </div>

        {/* Right Column: AI Lesson Assistant */}
        <LessonAssistant
          key={lesson.id}
          currentLessonTopic={lesson.topic}
          lessonId={Number(lesson.id)}
          lessonDescription={lesson.description}
          challengeContext={challengeContext}
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

