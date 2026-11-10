import { Link } from 'react-router-dom'
import type { CourseNavigation } from '../../../../data/lessons'
import './CourseSidebar.css'

interface CourseSidebarProps {
  courseNav: CourseNavigation
  activeLessonId: string
  isOpenOnMobile?: boolean
  onCloseMobile?: () => void
}

export default function CourseSidebar({
  courseNav,
  activeLessonId,
  isOpenOnMobile = false,
  onCloseMobile,
}: CourseSidebarProps) {
  const percentCompleted = Math.round(
    (courseNav.completedLessons / courseNav.totalLessons) * 100
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenOnMobile && (
        <div
          className="course-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`course-sidebar ${isOpenOnMobile ? 'course-sidebar--mobile-open' : ''}`}
        aria-label="Course navigation"
      >
        {/* Mobile close button */}
        <div className="course-sidebar__mobile-header">
          <span className="course-sidebar__mobile-title">Course outline</span>
          <button
            type="button"
            className="course-sidebar__close-btn"
            onClick={onCloseMobile}
            aria-label="Close course navigation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Course Header */}
        <div className="course-sidebar__header">
          <span className="course-sidebar__label">Your course</span>
          <h2 className="course-sidebar__title">{courseNav.title}</h2>
          <p className="course-sidebar__desc">{courseNav.description}</p>

          <div className="course-sidebar__progress-meta">
            <span>
              {courseNav.completedLessons} of {courseNav.totalLessons} lessons completed
            </span>
          </div>

          <div className="course-sidebar__progress-bar">
            <div
              className="course-sidebar__progress-fill"
              style={{ width: `${percentCompleted}%` }}
              role="progressbar"
              aria-valuenow={percentCompleted}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Module Sections */}
        <div className="course-sidebar__modules">
          {courseNav.modules.map((module) => (
            <div key={module.id} className="course-sidebar__module">
              <h3 className="course-sidebar__module-heading">
                {module.number} {module.title}
              </h3>

              <ul className="course-sidebar__lesson-list">
                {module.lessons.map((lesson) => {
                  const isActive = lesson.id === activeLessonId
                  const isCompleted = lesson.status === 'completed'

                  return (
                    <li key={lesson.id} className="course-sidebar__lesson-wrapper">
                      <Link
                        to={`/lessons/${lesson.id}`}
                        onClick={onCloseMobile}
                        className={`course-sidebar__lesson-item ${
                          isActive
                            ? 'course-sidebar__lesson-item--active'
                            : isCompleted
                            ? 'course-sidebar__lesson-item--completed'
                            : 'course-sidebar__lesson-item--upcoming'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {/* Status Icon or Number */}
                        <div className="course-sidebar__lesson-icon">
                          {isCompleted ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width="14"
                              height="14"
                              className="course-sidebar__checkmark"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span className="course-sidebar__lesson-number">
                              {lesson.number}
                            </span>
                          )}
                        </div>

                        {/* Title and Duration/Status */}
                        <div className="course-sidebar__lesson-details">
                          <span className="course-sidebar__lesson-title">
                            {lesson.title}
                          </span>
                          <span className="course-sidebar__lesson-meta">
                            {isActive
                              ? `In progress · ${lesson.duration}`
                              : lesson.duration}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}

