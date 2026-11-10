import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { COURSE_NAV_DATA, LESSON_DETAILS, type LessonDetail as LessonDetailType } from '../../data/lessons'
import CourseSidebar from './components/CourseSidebar/CourseSidebar'
import LessonContent from './components/LessonContent/LessonContent'
import LessonAssistant from './components/LessonAssistant/LessonAssistant'
import './LessonDetail.css'

export default function LessonDetail() {
  const { id } = useParams<{ id: string }>()

  // Find lesson by id, fallback to Lesson 4 (Functions)
  const lesson: LessonDetailType = useMemo(() => {
    if (id && LESSON_DETAILS[id]) {
      return LESSON_DETAILS[id]
    }
    return LESSON_DETAILS['4']
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
          courseNav={COURSE_NAV_DATA}
          activeLessonId={lesson.id}
          isOpenOnMobile={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Center Column: Main Lesson Content Area */}
        <div className="lesson-center-column">
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

