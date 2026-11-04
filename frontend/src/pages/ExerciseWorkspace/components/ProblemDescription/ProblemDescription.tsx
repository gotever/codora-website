import type { Exercise } from '../../../../data/exercises'
import './ProblemDescription.css'

interface ProblemDescriptionProps {
  exercise: Exercise
}

type Difficulty = 'Easy' | 'Medium' | 'Hard'

function getDifficultyClass(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Easy':
      return 'prob-desc__badge--easy'
    case 'Medium':
      return 'prob-desc__badge--medium'
    case 'Hard':
      return 'prob-desc__badge--hard'
  }
}

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function ProblemDescription({ exercise }: ProblemDescriptionProps) {
  return (
    <article className="prob-desc">
      {/* Title row */}
      <div className="prob-desc__title-row">
        <h1 className="prob-desc__title">
          {String(exercise.number).padStart(2, '0')}. {exercise.title}
        </h1>
        <button type="button" className="prob-desc__bookmark" aria-label="Bookmark exercise">
          <BookmarkIcon />
        </button>
      </div>

      {/* Difficulty + tags */}
      <div className="prob-desc__tags-row">
        <span className={`prob-desc__badge ${getDifficultyClass(exercise.difficulty as Difficulty)}`}>
          {exercise.difficulty}
        </span>
        {exercise.tags.map((tag) => (
          <span key={tag} className="prob-desc__tag">
            {tag}
          </span>
        ))}
      </div>

      {/* Description */}
      <p
        className="prob-desc__body"
        dangerouslySetInnerHTML={{ __html: exercise.description }}
      />

      {/* Function signature call-out */}
      {exercise.functionSignature && (
        <p className="prob-desc__body">
          Complete{' '}
          <code className="prob-desc__inline-code">{exercise.functionSignature}</code>. If
          there are no even numbers, return 0.
        </p>
      )}

      {/* Examples */}
      {exercise.examples.map((example) => (
        <div key={example.id} className="prob-desc__example">
          <p className="prob-desc__example-heading">Example {example.id}</p>
          <div className="prob-desc__example-block">
            <div className="prob-desc__example-row">
              <span className="prob-desc__example-label">Input:</span>
              <span className="prob-desc__example-code">{example.input}</span>
            </div>
            <div className="prob-desc__example-row">
              <span className="prob-desc__example-label">Output:</span>
              <span className="prob-desc__example-code">{example.output}</span>
            </div>
            {example.explanation && (
              <p className="prob-desc__example-explanation">{example.explanation}</p>
            )}
          </div>
        </div>
      ))}

      {/* Constraints */}
      {exercise.constraints.length > 0 && (
        <div className="prob-desc__section">
          <p className="prob-desc__section-heading">Constraints</p>
          <ul className="prob-desc__constraints">
            {exercise.constraints.map((c, i) => (
              <li key={i} className="prob-desc__constraint-item">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related lesson */}
      {exercise.relatedLesson && (
        <div className="prob-desc__related">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            width="14"
            height="14"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Brush up on{' '}
          <a href={exercise.relatedLesson.to} className="prob-desc__related-link">
            {exercise.relatedLesson.label} →
          </a>
        </div>
      )}
    </article>
  )
}

