import type { Course } from '../../data/courses'
import LessonRow from '../LessonRow/LessonRow'
import './CourseCard.css'

interface CourseCardProps {
  course: Course
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="course-card" aria-labelledby={`course-${course.id}-title`}>
      {/* Header */}
      <div className="course-card__header">
        <h2 className="course-card__title" id={`course-${course.id}-title`}>
          {course.title}
        </h2>
        <p className="course-card__meta">
          {course.lessonCount} lessons
          <span className="course-card__meta-dot">·</span>
          {course.paceLabel}
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
