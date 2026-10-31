import CourseCard from '../../components/CourseCard/CourseCard'
import { COURSES } from '../../data/courses'
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
          {COURSES.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </main>
  )
}
