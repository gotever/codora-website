import './Hero.css'

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      {/* Badge */}
      <div className="hero__badge" aria-label="Your Python journey starts here">
        <span className="hero__badge-icon">✦</span>
        Your Python journey starts here
      </div>

      {/* Headline */}
      <h1 className="hero__headline" id="hero-heading">
        Welcome to your{' '}
        <span className="hero__headline-accent">Python</span>
        <br />
        learning space.
      </h1>

      {/* Subtitle */}
      <p className="hero__subtitle">
        Understand the basics, put your skills into practice, and get a little
        help from your AI tutor along the way. One line at a time.
      </p>

      {/* CTAs */}
      <div className="hero__actions">
        <button
          type="button"
          className="hero__btn hero__btn--primary"
          id="btn-start-learning"
        >
          Start learning
          <span className="hero__btn-icon" aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="hero__btn hero__btn--secondary"
          id="btn-try-exercise"
        >
          Try an exercise
          <span className="hero__btn-icon" aria-hidden="true">&lt;/&gt;</span>
        </button>
      </div>

      {/* Code hint */}
      <p className="hero__code-hint" aria-label='print("Hello, future Pythonista!")'>
        <span className="hero__code-prompt">&gt;&gt;&gt;</span>
        &nbsp;print(&quot;Hello, future Pythonista!&quot;)
      </p>
    </section>
  )
}
