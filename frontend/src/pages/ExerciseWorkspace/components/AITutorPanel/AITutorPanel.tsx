import { useState, useRef, useEffect } from 'react'
import { fetchChats, saveChat } from '../../../../lib/api'
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
  isOpen: boolean
  onToggle: () => void
}

const SUGGESTED_PROMPTS = [
  'Explain this concept',
  'Review my approach',
  'Explain this error',
  'Give me a tiny nudge',
]

function getMockResponse(prompt: string, exerciseTitle: string, currentCode: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('concept')) {
    return `In **${exerciseTitle}**, the key concept is **filtering with the modulo operator** inside a loop.
    
When you evaluate \`number % 2 == 0\`, it checks if the remainder of dividing by 2 is zero. If it is, the number is even! Combining this with an accumulator variable lets you build up your answer step by step.`
  }
  if (lower.includes('approach') || lower.includes('review')) {
    const hasPass = currentCode.includes('pass')
    const hasLoop = currentCode.includes('for ')
    const hasReturn = currentCode.includes('return ')

    if (hasPass && !hasLoop) {
      return `Looking at your code for **${exerciseTitle}**: You currently have the starter \`pass\` placeholder.

To get started:
1. Create a variable before the loop to accumulate the sum: \`total = 0\`
2. Write a \`for\` loop over \`numbers\`
3. Check each number with \`if number % 2 == 0:\`
4. Add to \`total\` and \`return total\` at the end!`
    }

    if (hasLoop && !hasReturn) {
      return `I see you've started looping! Don't forget that your function must explicitly \`return\` the calculated sum at the end, otherwise Python returns \`None\`.`
    }

    return `Great progress! Here is how to verify your approach:
    
1. **Accumulator**: Is your \`total = 0\` initialised outside the loop?
2. **Modulo check**: Are you testing \`number % 2 == 0\`?
3. **Return statement**: Is \`return total\` properly indented outside the \`for\` block?

Try clicking **Run** to test it against Case 1!`
  }
  if (lower.includes('error')) {
    return `Common errors on this problem include:
- **Returning too early**: Make sure your \`return\` statement is outside the \`for\` loop, not inside!
- **Using \`=\` instead of \`==\`**: Comparison requires two equals signs (\`==\`).
- **Printing instead of returning**: The test cases check what your function returns, so use \`return total\` instead of \`print(total)\`.`
  }
  if (lower.includes('nudge') || lower.includes('hint')) {
    return `Here's a nudge: Start with \`total = 0\` before your loop. Every time you find an even number, add it to \`total\`. What happens if the list has no even numbers? Because \`total\` started at 0, you'll naturally return 0 — exactly what the problem requires!`
  }
  return `I'm here to help you work through **${exerciseTitle}**! Try running your code with Case 1 first. If the output doesn't match, check how your condition evaluates each number.`
}

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
    fetchChats(exercise.id).then((saved) => {
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
  }, [exercise.id])

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
    if (typeof exercise.id === 'number') {
      void saveChat(text, 'user', exercise.id, currentCode).catch(() => undefined)
    }
    if (!textToSend) setInputValue('')
    setIsTyping(true)

    // Simulate AI thinking and replying
    setTimeout(() => {
      const tutorReply: ChatMessage = {
        id: generateMessageId(),
        sender: 'tutor',
        text: getMockResponse(text, exercise.title, currentCode),
        timestamp: getCurrentTimeStr(),
      }
      setMessages((prev) => [...prev, tutorReply])
      if (typeof exercise.id === 'number') {
        void saveChat(tutorReply.text, 'assistant', exercise.id, currentCode).catch(() => undefined)
      }
      setIsTyping(false)
    }, 800)
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
