import { useState, useRef, useEffect } from 'react'
import { askTutor, fetchContextChats } from '../../../../lib/api'
import type { Exercise } from '../../../../data/exercises'
import './AITutorPanel.css'

export interface ChatMessage {
  id: string
  sender: 'tutor' | 'user'
  text: string
  timestamp: string
}

interface AITutorPanelProps {
  exercise: Exercise
  currentCode: string
  currentActivity: string
  isOpen: boolean
  onToggle: () => void
}

const SUGGESTED_PROMPTS = [
  'Explain this concept',
  'Review my approach',
  'Explain this error',
  'Give me a tiny nudge',
]

let messageCounter = 0
function generateMessageId(): string {
  messageCounter += 1
  return `msg-${Date.now()}-${messageCounter}`
}

function getCurrentTimeStr(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AITutorPanel({
  exercise,
  currentCode,
  currentActivity,
  isOpen,
  onToggle,
}: AITutorPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'tutor',
      text: `Hi! I'm your AI tutor. I can explain concepts, help spot bugs, or give you guidance on **${exercise.title}** without spoiling the solution. What's on your mind?`,
      timestamp: 'Just now',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen, isTyping])

  useEffect(() => {
    if (typeof exercise.id !== 'number') return
    let active = true
    fetchContextChats('exercise', exercise.id).then((saved) => {
      if (active && saved.length) {
        setMessages(saved.map((item) => ({
          id: item.id,
          sender: item.role === 'assistant' ? 'tutor' : 'user',
          text: item.message,
          timestamp: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })))
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [exercise.id, exercise.title])

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim()
    if (!text || isTyping) return

    const userMsg: ChatMessage = {
      id: generateMessageId(),
      sender: 'user',
      text,
      timestamp: getCurrentTimeStr(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputValue('')
    setIsTyping(true)

    if (typeof exercise.id !== 'number') {
      setMessages((prev) => [...prev, { id: generateMessageId(), sender: 'tutor', text: 'AI tutor is unavailable because this exercise is not connected to the backend.', timestamp: getCurrentTimeStr() }])
      setIsTyping(false)
      return
    }
    void askTutor({
      context_type: 'exercise',
      context_id: exercise.id,
      message: text,
      code_snapshot: currentCode,
      activity: currentActivity,
    }).then(({ answer }) => {
      setMessages((prev) => [...prev, { id: generateMessageId(), sender: 'tutor', text: answer, timestamp: getCurrentTimeStr() }])
    }).catch((error: unknown) => {
      const fallback = error instanceof Error && error.message.includes('(401)')
        ? 'Please sign in to use the AI tutor and save conversation memory.'
        : 'The tutor could not respond right now. Please try again.'
      setMessages((prev) => [...prev, { id: generateMessageId(), sender: 'tutor', text: fallback, timestamp: getCurrentTimeStr() }])
    }).finally(() => setIsTyping(false))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating launcher button when collapsed */}
      {!isOpen && (
        <button
          type="button"
          className="ai-tutor-launcher"
          onClick={onToggle}
          aria-label="Open AI Tutor"
        >
          <div className="ai-tutor-launcher__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.9 3.56a1 1 0 0 0-.36 1.12L17.5 20l-4.9-3.56a1 1 0 0 0-1.18 0L6.5 20l1.87-5.87a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z" />
            </svg>
          </div>
          <span className="ai-tutor-launcher__text">Ask AI Tutor</span>
          <span className="ai-tutor-launcher__badge">Beta</span>
        </button>
      )}

      {/* Slide-out Drawer Panel */}
      <aside
        className={`ai-tutor-panel ${isOpen ? 'ai-tutor-panel--open' : ''}`}
        aria-label="AI Tutor Chat"
      >
        {/* Panel Header */}
        <div className="ai-tutor-panel__header">
          <div className="ai-tutor-panel__title-wrap">
            <div className="ai-tutor-panel__icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.9 3.56a1 1 0 0 0-.36 1.12L17.5 20l-4.9-3.56a1 1 0 0 0-1.18 0L6.5 20l1.87-5.87a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z" />
              </svg>
            </div>
            <div>
              <h2 className="ai-tutor-panel__title">Codora AI Tutor</h2>
              <span className="ai-tutor-panel__subtitle">Guiding your learning</span>
            </div>
          </div>
          <button
            type="button"
            className="ai-tutor-panel__close-btn"
            onClick={onToggle}
            aria-label="Close AI Tutor panel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Suggested Quick Action Chips */}
        <div className="ai-tutor-panel__quick-actions">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="ai-tutor-panel__quick-btn"
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="ai-tutor-panel__chat-history">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`ai-tutor-msg ai-tutor-msg--${msg.sender}`}
            >
              <div className="ai-tutor-msg__bubble">
                <p className="ai-tutor-msg__text">{msg.text}</p>
                <span className="ai-tutor-msg__time">{msg.timestamp}</span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="ai-tutor-msg ai-tutor-msg--tutor">
              <div className="ai-tutor-msg__bubble ai-tutor-msg__bubble--typing">
                <span className="ai-tutor-typing-dot" />
                <span className="ai-tutor-typing-dot" />
                <span className="ai-tutor-typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input */}
        <div className="ai-tutor-panel__input-area">
          <textarea
            className="ai-tutor-panel__input"
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or request a hint..."
            aria-label="Ask your AI tutor"
          />
          <button
            type="button"
            className="ai-tutor-panel__send-btn"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
