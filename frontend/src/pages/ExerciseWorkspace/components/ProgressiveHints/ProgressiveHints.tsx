import { useState } from 'react'
import type { HintLevel } from '../../../../data/exercises'
import './ProgressiveHints.css'
import { sanitizeHtml } from '../../../../lib/sanitizeHtml'

interface ProgressiveHintsProps {
  hints: HintLevel[]
}

const LEVEL_ICONS = {
  1: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  2: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="12" r="10" />
      <path d="M12 17h.01" />
    </svg>
  ),
  3: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
}

export default function ProgressiveHints({ hints }: ProgressiveHintsProps) {
  // Track which hints the user has unlocked (revealed)
  const [unlockedLevels, setUnlockedLevels] = useState<Set<number>>(new Set())
  const [openLevel, setOpenLevel] = useState<number | null>(null)

  const maxUnlocked = unlockedLevels.size === 0 ? 0 : Math.max(...unlockedLevels)

  function handleReveal(level: number) {
    setUnlockedLevels((prev) => {
      const next = new Set(prev)
      next.add(level)
      return next
    })
    setOpenLevel(level)
  }

  function handleToggle(level: number) {
    setOpenLevel((prev) => (prev === level ? null : level))
  }

  const canReveal = (level: number) => {
    // Level 1 is always revealable; subsequent levels require the previous one unlocked
    return level === 1 || unlockedLevels.has(level - 1)
  }

  return (
    <div className="prog-hints">
      <div className="prog-hints__header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Need a nudge? Show a hint
      </div>

      <div className="prog-hints__list">
        {hints.map((hint) => {
          const isUnlocked = unlockedLevels.has(hint.level)
          const isOpen = openLevel === hint.level
          const isAvailable = canReveal(hint.level)
          const isLocked = !isUnlocked && !isAvailable
          const isPending = !isUnlocked && isAvailable

          return (
            <div
              key={hint.level}
              className={[
                'prog-hints__item',
                isUnlocked ? 'prog-hints__item--unlocked' : '',
                isLocked ? 'prog-hints__item--locked' : '',
                isPending ? 'prog-hints__item--pending' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Item header */}
              <div className="prog-hints__item-header">
                <div className="prog-hints__item-left">
                  <span
                    className={[
                      'prog-hints__level-icon',
                      isUnlocked ? `prog-hints__level-icon--${hint.level}` : '',
                      isLocked ? 'prog-hints__level-icon--locked' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isLocked ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      LEVEL_ICONS[hint.level]
                    )}
                  </span>
                  <div className="prog-hints__item-info">
                    <span className="prog-hints__item-label">
                      Level {hint.level} — {hint.label}
                    </span>
                    <span className="prog-hints__item-sublabel">{hint.sublabel}</span>
                  </div>
                </div>

                {/* Action: reveal or toggle */}
                {isLocked ? (
                  <span className="prog-hints__locked-label">
                    Unlock Level {hint.level - 1} first
                  </span>
                ) : isUnlocked ? (
                  <button
                    type="button"
                    className="prog-hints__toggle"
                    onClick={() => handleToggle(hint.level)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Hide hint' : 'Show hint'}
                  >
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
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="prog-hints__reveal-btn"
                    onClick={() => handleReveal(hint.level)}
                  >
                    Show hint
                  </button>
                )}
              </div>

              {/* Hint content (only when unlocked and open) */}
              {isUnlocked && isOpen && (
                <div
                  className="prog-hints__content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(hint.content) }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress indicator */}
      <div className="prog-hints__progress">
        <div className="prog-hints__progress-bar">
          <div
            className="prog-hints__progress-fill"
            style={{ width: `${(maxUnlocked / hints.length) * 100}%` }}
          />
        </div>
        <span className="prog-hints__progress-label">
          {maxUnlocked} of {hints.length} hints revealed
        </span>
      </div>
    </div>
  )
}

