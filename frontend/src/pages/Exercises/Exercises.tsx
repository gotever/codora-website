import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXERCISE_LIST, type ExerciseListItem } from '../../data/exercises'
import { fetchExercises, fetchProgress } from '../../lib/api'
import './Exercises.css'

type Difficulty = 'Easy' | 'Medium' | 'Hard'

function getDifficultyClass(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Easy':
      return 'exercises-page__badge--easy'
    case 'Medium':
      return 'exercises-page__badge--medium'
    case 'Hard':
      return 'exercises-page__badge--hard'
  }
}

function CodeBracketsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="16"
      height="16"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

export default function Exercises() {
  const [exercises, setExercises] = useState<ExerciseListItem[]>(EXERCISE_LIST)
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let active = true
    fetchExercises().then((records) => {
      if (!active) return
      setExercises(records.map((record, index) => {
        const fallback = EXERCISE_LIST.find((item) => item.id === record.id || item.title === record.title)
        return {
          id: record.id,
          number: record.test_cases.number ?? fallback?.number ?? index + 1,
          title: record.title,
          difficulty: record.difficulty,
          tags: record.tags,
          courseId: record.test_cases.courseId ?? fallback?.courseId ?? String(record.course_id),
          courseTitle: record.course_title,
        }
      }).sort((left, right) => left.number - right.number))
    }).catch(() => {
      // The local curriculum remains usable while the optional API is offline.
    })
    fetchProgress().then((progress) => {
      if (!active) return
      setCompletedExerciseIds(new Set(
        progress
          .filter((item) => item.item_type === 'exercise' && item.status === 'completed')
          .map((item) => String(item.item_id)),
      ))
    }).catch(() => {
      // Progress is account-specific and unavailable when signed out.
    })
    return () => { active = false }
  }, [])

  return (
    <main className="exercises-page" id="main-content">
      <div className="exercises-page__content">
        {/* Page header */}
        <header className="exercises-page__header">
          <div className="exercises-page__label">
            <CodeBracketsIcon />
            Exercises
          </div>
          <h1 className="exercises-page__title">Python fundamentals</h1>
          <p className="exercises-page__subtitle">
            Practice what you've learned with hands-on coding challenges.
          </p>
        </header>

        {/* Exercise list */}
        <div className="exercises-page__list">
          {exercises.map((exercise) => (
            <Link
              key={exercise.id}
              to={`/exercises/${exercise.id}`}
              className="exercises-page__item"
              aria-label={`Exercise ${String(exercise.number).padStart(2, '0')}: ${exercise.title}`}
            >
              <span className="exercises-page__item-number">
                {String(exercise.number).padStart(2, '0')}
              </span>
              <div className="exercises-page__item-info">
                <span className="exercises-page__item-title">{exercise.title}</span>
                <div className="exercises-page__item-tags">
                  {exercise.tags.map((tag) => (
                    <span key={tag} className="exercises-page__item-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="exercises-page__item-badges">
                {completedExerciseIds.has(String(exercise.id)) && (
                  <span className="exercises-page__completed-badge" aria-label="Completed">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Completed
                  </span>
                )}
                <span
                  className={`exercises-page__badge ${getDifficultyClass(exercise.difficulty as Difficulty)}`}
                >
                  {exercise.difficulty}
                </span>
              </div>
              <svg
                className="exercises-page__item-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                width="16"
                height="16"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

