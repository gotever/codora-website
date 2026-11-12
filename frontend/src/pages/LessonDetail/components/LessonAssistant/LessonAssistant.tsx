import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../../../../data/lessons'
import { INITIAL_ASSISTANT_MESSAGES } from '../../../../data/lessons'
import { askTutor, fetchContextChats } from '../../../../lib/api'
import './LessonAssistant.css'

interface LessonAssistantProps {
  currentLessonTopic: string
  lessonId: number
  lessonDescription: string
  isOpenOnMobile?: boolean
  onCloseMobile?: () => void
  externalPrompt?: string
}

export default function LessonAssistant({
  currentLessonTopic,
  lessonId,
  lessonDescription,
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

  useEffect(() => {
    let active = true
    fetchContextChats('lesson', lessonId).then((saved) => {
      if (active && saved.length) {
        setMessages(saved.map((item) => ({
          id: item.id,
          sender: item.role,
          paragraphs: item.role === 'assistant' ? [item.message] : undefined,
          text: item.role === 'user' ? item.message : undefined,
          timestamp: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })))
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [lessonId])

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

    void askTutor({
      context_type: 'lesson',
      context_id: lessonId,
      message: text,
      activity: `Learner is reading ${currentLessonTopic}. ${lessonDescription}`,
    }).then(({ answer }) => {
      setMessages((prev) => [...prev, {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        paragraphs: [answer],
        timestamp: 'Just now',
        feedbackGiven: null,
      }])
    }).catch((error: unknown) => {
      const notice = error instanceof Error && error.message.includes('(401)')
        ? 'Please sign in to use the AI tutor and save conversation memory.'
        : 'The tutor could not respond right now. Please try again.'
      setMessages((prev) => [...prev, { id: `asst-${Date.now()}`, sender: 'assistant', paragraphs: [notice], timestamp: 'Just now', feedbackGiven: null }])
    }).finally(() => setIsTyping(false))
  }, [inputValue, isTyping, currentLessonTopic, lessonDescription, lessonId])
  // Keep a stable ref to handleSend so the externalPrompt effect never
  // needs handleSend as a dependency (avoids an infinite re-trigger loop
  // caused by isTyping toggling → handleSend recreation → effect re-runs).
  const handleSendRef = useRef(handleSend)
  useEffect(() => {
    handleSendRef.current = handleSend
  })

  // Handle external hint request (e.g. from "Ask AI for a hint →" in the embedded challenge).
  // We track the last prompt we already sent so clicking the same challenge button
  // twice in a row still only fires once.
  const lastExternalPromptRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (externalPrompt && externalPrompt !== lastExternalPromptRef.current) {
      lastExternalPromptRef.current = externalPrompt
      const timer = setTimeout(() => {
        handleSendRef.current(externalPrompt)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [externalPrompt])

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
            {currentLessonTopic}
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
