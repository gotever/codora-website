import type { Lesson } from '../../data/courses'
import './LessonRow.css'

interface LessonRowProps {
  lesson: Lesson
}

function ArrowIcon() {
  return (
    <svg
      className="lesson-row__arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

export default function LessonRow({ lesson }: LessonRowProps) {
  const padded = String(lesson.id).padStart(2, '0')

  return (
    <li className="lesson-row" role="listitem">
      <span className="lesson-row__number" aria-label={`Lesson ${padded}`}>
        {padded}
      </span>
      <div className="lesson-row__content">
        <p className="lesson-row__title">{lesson.title}</p>
        <p className="lesson-row__description">{lesson.description}</p>
      </div>
      <ArrowIcon />
    </li>
  )
}
