import './LearningCard.css'

// Icon: open book (inline SVG)
function BookIcon() {
  return (
    <svg className="learning-card__label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

// Icon: document
function DocIcon() {
  return (
    <svg className="learning-card__preview-doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export default function LearningCard() {
  return (
    <article className="learning-card" aria-labelledby="learning-card-heading">
      {/* Top label row */}
      <div className="learning-card__top">
        <div className="learning-card__label">
          <BookIcon />
          Learning
        </div>
        <span className="learning-card__badge">Beginner friendly</span>
      </div>

      {/* Heading */}
      <h3 className="learning-card__heading" id="learning-card-heading">
        Build a strong foundation.
      </h3>

      {/* Description */}
      <p className="learning-card__description">
        Clear explanations, bite-sized lessons, and examples that make Python
        click. No experience needed.
      </p>

      {/* Lesson preview */}
      <div className="learning-card__preview">
        <div className="learning-card__preview-meta">
          <span className="learning-card__preview-chapter">01 / Getting Started</span>
          <span className="learning-card__preview-time">5 min read</span>
        </div>
        <div className="learning-card__preview-title">
          <DocIcon />
          Your first <span>Python</span> program
        </div>
      </div>

      {/* Footer */}
      <div className="learning-card__footer">
        <span className="learning-card__footer-note">From your first line to functions</span>
        <a href="#" className="learning-card__link" id="link-explore-lessons">
          Explore lessons →
        </a>
      </div>
    </article>
  )
}
