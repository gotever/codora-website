import { Link } from 'react-router-dom'
import './ExercisesCard.css'

// Icon: code brackets </> 
function CodeIcon() {
  return (
    <svg className="exercises-card__label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

export default function ExercisesCard() {
  return (
    <article className="exercises-card" aria-labelledby="exercises-card-heading">
      {/* Top label row */}
      <div className="exercises-card__top">
        <div className="exercises-card__label">
          <CodeIcon />
          Exercises
        </div>
        <span className="exercises-card__badge">Beginner friendly</span>
      </div>

      {/* Heading */}
      <h3 className="exercises-card__heading" id="exercises-card-heading">
        Turn "I get it" into "I can do it."
      </h3>

      {/* Description */}
      <p className="exercises-card__description">
        Learn by doing with hands-on coding challenges. Try, test, and build
        confidence with every solution.
      </p>

      {/* Code preview */}
      <div className="exercises-card__code-block" role="region" aria-label="Sample exercise preview">
        <div className="exercises-card__code-header">
          <span className="exercises-card__filename">hello_world.py</span>
          <span className="exercises-card__difficulty">Easy</span>
        </div>
        <div className="exercises-card__code-body">
          <span className="exercises-card__line-number" aria-hidden="true">1</span>
          <code className="exercises-card__code-line">
            <span className="exercises-card__code-fn">print</span>
            (<span className="exercises-card__code-str">"Hello, world!"</span>)
          </code>
        </div>
      </div>

      {/* Footer */}
      <div className="exercises-card__footer">
        <span className="exercises-card__footer-note">
          Instant feedback
          <span>·</span>
          Helpful hints
        </span>
        <Link to="/exercises" className="exercises-card__link" id="link-browse-exercises">
          Browse exercises →
        </Link>
      </div>
    </article>
  )
}
