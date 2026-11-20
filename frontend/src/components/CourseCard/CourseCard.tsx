import type { Course } from '../../data/courses'
import LessonRow from '../LessonRow/LessonRow'
import './CourseCard.css'

interface CourseCardProps {
  course: Course
}

export default function CourseCard({ course }: CourseCardProps) {
  const isCompleted = course.lessonCount > 0 && course.completedLessonCount === course.lessonCount

  return (
    <article className="course-card" aria-labelledby={`course-${course.id}-title`}>
      {/* Header */}
      <div className="course-card__header">
        <div className="course-card__title-row">
          <h2 className="course-card__title" id={`course-${course.id}-title`}>
            {course.title}
          </h2>
          {isCompleted && <span className="course-card__completed">Course completed</span>}
        </div>
        <p className="course-card__meta">
          {course.completedLessonCount === undefined
            ? `${course.lessonCount} lessons`
            : `${course.completedLessonCount} of ${course.lessonCount} lessons completed`}
          {course.paceLabel && (
            <>
              <span className="course-card__meta-dot">·</span>
              {course.paceLabel}
            </>
          )}
        </p>
      </div>

      {/* Lesson list */}
      <ul className="course-card__lessons" aria-label={`Lessons in ${course.title}`}>
        {course.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
      </ul>

      {/* Footer */}
      <div className="course-card__footer">
        <p className="course-card__footer-hint">
          New to Python? Begin with lesson 01 and work your way down.
        </p>
        <span className="course-card__footer-label">Course preview</span>
      </div>
    </article>
  )
}
