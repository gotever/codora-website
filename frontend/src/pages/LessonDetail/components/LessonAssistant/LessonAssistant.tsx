import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../../../../data/lessons'
import { INITIAL_ASSISTANT_MESSAGES } from '../../../../data/lessons'
import './LessonAssistant.css'

interface LessonAssistantProps {
  currentLessonTopic: string
  isOpenOnMobile?: boolean
  onCloseMobile?: () => void
  externalPrompt?: string
}

export default function LessonAssistant({
  currentLessonTopic,
  isOpenOnMobile = false,
  onCloseMobile,
  externalPrompt,
}: LessonAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_ASSISTANT_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = useCallback((textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim()
    if (!text || isTyping) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
    }

    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInputValue('')
    setIsTyping(true)

    // Generate smart mock assistant response based on prompt
    setTimeout(() => {
      let response: ChatMessage
      const lower = text.toLowerCase()

      if (lower.includes('hint') || lower.includes('double')) {
        response = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          title: 'Here is a hint for your challenge',
          paragraphs: [
            'In Python, you multiply numbers using the asterisk (*) operator.',
            'Inside your double(number) function, write: return number * 2.',
            'Remember: replacing pass with return ensures the value gets sent back to the caller!',
          ],
          timestamp: 'Just now',
          feedbackGiven: null,
        }
      } else if (lower.includes('another way') || lower.includes('explain')) {
        response = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          title: 'Another way to think about return',
          paragraphs: [
            'Imagine ordering food at a restaurant.',
            'When the chef makes your meal, they hand the plate back to the waiter (this is return).',
            'If the chef simply shouted "Your food is ready!" but never handed the plate over, you would have nothing to eat (that would be print).',
          ],
          analogy: {
            label: 'QUICK RULE OF THUMB',
            lines: [
              'Use print() when you want a human to see text on the screen.',
              'Use return when you want another part of your code to use the result.',
            ],
          },
          closing: 'Functions without return give back None by default in Python.',
          timestamp: 'Just now',
          feedbackGiven: null,
        }
      } else {
        response = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          title: `Let's look at ${currentLessonTopic}`,
          paragraphs: [
            `That's a thoughtful question regarding ${currentLessonTopic.toLowerCase()}.`,
            'Functions give your code structure and prevent repetition. When you define parameters like (number), you allow the same formula to run with whatever value you supply.',
          ],
          closing: 'Try tweaking the code in the challenge to see how the return value changes!',
          timestamp: 'Just now',
          feedbackGiven: null,
        }
      }

      setMessages((prev) => [...prev, response])
      setIsTyping(false)
    }, 700)
  }, [inputValue, isTyping, currentLessonTopic])

  // Handle external hint request (e.g. from "Ask AI for a hint ->" in the embedded challenge)
  useEffect(() => {
    if (externalPrompt) {
      const timer = setTimeout(() => {
        handleSend(externalPrompt)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [externalPrompt, handleSend])

  const handleFeedback = (messageId: string, feedback: 'yes' | 'no') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedbackGiven: feedback } : m
      )
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenOnMobile && (
        <div
          className="lesson-assistant-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`lesson-assistant ${isOpenOnMobile ? 'lesson-assistant--mobile-open' : ''}`}
        aria-label="AI Lesson Assistant"
      >
        {/* Assistant Header */}
        <div className="lesson-assistant__header">
          <div className="lesson-assistant__header-left">
            <div className="lesson-assistant__avatar" aria-hidden="true">
              AI
            </div>
            <div className="lesson-assistant__header-info">
              <h2 className="lesson-assistant__title">Lesson assistant</h2>
              <span className="lesson-assistant__subtitle">
                A little help, right when you need it.
              </span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              className="lesson-assistant__mobile-close"
              onClick={onCloseMobile}
              aria-label="Close assistant"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Lesson Context Card */}
        <div className="lesson-assistant__context-card">
          <span className="lesson-assistant__context-label">Learning with you</span>
          <h3 className="lesson-assistant__context-title">
            {currentLessonTopic} & return values
          </h3>
          <p className="lesson-assistant__context-subtitle">
            I can see the lesson you're working on.
          </p>
        </div>

        {/* Conversation Area */}
        <div className="lesson-assistant__chat">
          <div className="lesson-assistant__date-divider">
            <span>TODAY</span>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`lesson-assistant__msg lesson-assistant__msg--${msg.sender}`}
            >
              {msg.sender === 'user' ? (
                <div className="lesson-assistant__user-bubble">
                  <p>{msg.text}</p>
                </div>
              ) : (
                <div className="lesson-assistant__asst-content">
                  {/* Assistant name/badge */}
                  <div className="lesson-assistant__asst-badge">
                    <span className="lesson-assistant__asst-avatar-mini">AI</span>
                    <span className="lesson-assistant__asst-name">Loop assistant</span>
                  </div>

                  {/* Heading & paragraphs */}
                  {msg.title && (
                    <h4 className="lesson-assistant__asst-title">{msg.title}</h4>
                  )}
                  {msg.paragraphs?.map((p, idx) => (
                    <p key={idx} className="lesson-assistant__asst-p">
                      {p}
                    </p>
                  ))}

                  {/* Comparison blocks (return vs print) */}
                  {msg.comparison && (
                    <div className="lesson-assistant__comparison">
                      <div className="lesson-assistant__comp-item">
                        <span className="lesson-assistant__comp-label">
                          {msg.comparison.itemA.label}
                        </span>
                        <span className="lesson-assistant__comp-desc">
                          {msg.comparison.itemA.description}
                        </span>
                      </div>
                      <div className="lesson-assistant__comp-divider" />
                      <div className="lesson-assistant__comp-item">
                        <span className="lesson-assistant__comp-label">
                          {msg.comparison.itemB.label}
                        </span>
                        <span className="lesson-assistant__comp-desc">
                          {msg.comparison.itemB.description}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Analogy card ("Think of it this way") */}
                  {msg.analogy && (
                    <div className="lesson-assistant__analogy-card">
                      <span className="lesson-assistant__analogy-label">
                        {msg.analogy.label}
                      </span>
                      {msg.analogy.lines.map((line, lIdx) => (
                        <p key={lIdx} className="lesson-assistant__analogy-line">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {msg.closing && (
                    <p className="lesson-assistant__asst-closing">{msg.closing}</p>
                  )}

                  {/* Feedback row */}
                  <div className="lesson-assistant__feedback">
                    <span className="lesson-assistant__feedback-label">
                      {msg.feedbackGiven ? 'Thanks for the feedback!' : 'Was this helpful?'}
                    </span>
                    {!msg.feedbackGiven && (
                      <div className="lesson-assistant__feedback-actions">
                        <button
                          type="button"
                          className="lesson-assistant__feedback-btn"
                          onClick={() => handleFeedback(msg.id, 'yes')}
                        >
                          Yes
                        </button>
                        <span>/</span>
                        <button
                          type="button"
                          className="lesson-assistant__feedback-btn"
                          onClick={() => handleFeedback(msg.id, 'no')}
                        >
                          Not quite
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="lesson-assistant__typing">
              <span className="lesson-assistant__typing-dot" />
              <span className="lesson-assistant__typing-dot" />
              <span className="lesson-assistant__typing-dot" />
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Actions (Keep exploring) */}
        <div className="lesson-assistant__quick-actions">
          <span className="lesson-assistant__quick-label">KEEP EXPLORING</span>
          <div className="lesson-assistant__quick-btns">
            <button
              type="button"
              className="lesson-assistant__quick-btn"
              onClick={() => handleSend('Explain another way')}
            >
              Explain another way
            </button>
            <button
              type="button"
              className="lesson-assistant__quick-btn"
              onClick={() => handleSend('Give me a hint')}
            >
              Give me a hint
            </button>
          </div>
        </div>

        {/* Chat Input Box */}
        <div className="lesson-assistant__input-box">
          <textarea
            className="lesson-assistant__textarea"
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this lesson..."
            aria-label="Ask about this lesson"
          />
          <div className="lesson-assistant__input-footer">
            <span className="lesson-assistant__context-badge">
              Lesson context included
            </span>
            <button
              type="button"
              className="lesson-assistant__send-btn"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send question to lesson assistant"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer disclaimer */}
        <p className="lesson-assistant__disclaimer">
          AI can make mistakes. Stay curious.
        </p>
      </aside>
    </>
  )
}
