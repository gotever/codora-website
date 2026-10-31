import './AiNudgeBanner.css'

// Icon: sparkles / AI star
function SparklesIcon() {
  return (
    <svg className="ai-nudge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.9 3.56a1 1 0 0 0-.36 1.12L17.5 20l-4.9-3.56a1 1 0 0 0-1.18 0L6.5 20l1.87-5.87a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z" />
    </svg>
  )
}

// Icon: chat bubble
function ChatIcon() {
  return (
    <svg className="ai-nudge__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function AiNudgeBanner() {
  return (
    <aside className="ai-nudge" aria-label="AI tutor prompt">
      <div className="ai-nudge__left">
        <div className="ai-nudge__icon-wrap">
          <SparklesIcon />
        </div>
        <div className="ai-nudge__text">
          <p className="ai-nudge__title">A little stuck? That's part of learning.</p>
          <p className="ai-nudge__subtitle">
            Ask your AI tutor to explain a concept, unpack an error, or give you a nudge in the right direction.
          </p>
        </div>
      </div>

      <button type="button" className="ai-nudge__btn" id="btn-figure-it-out">
        Let's figure it out
        <ChatIcon />
      </button>
    </aside>
  )
}
