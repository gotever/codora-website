import { useEffect, useRef, useState, useMemo } from 'react'
import './WorkspaceCodeEditor.css'

interface WorkspaceCodeEditorProps {
  value: string
  onChange: (value: string) => void
  filename: string
  language?: string
  onReset?: () => void
}

const LANGUAGES = ['Python 3', 'JavaScript', 'TypeScript']

// Tokenizer for Python syntax highlighting
function highlightPython(code: string): string {
  const lines = code.split('\n')
  return lines
    .map((line) => {
      // Escape HTML entities first
      let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      // Comments
      const commentIdx = escaped.indexOf('#')
      let commentPart = ''
      if (commentIdx !== -1) {
        commentPart = `<span class="tok-comment">${escaped.slice(commentIdx)}</span>`
        escaped = escaped.slice(0, commentIdx)
      }

      // Triple quoted docstrings or strings
      escaped = escaped.replace(
        /(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|"""[\s\S]*?"""|'''[\s\S]*?''')/g,
        '<span class="tok-string">$1</span>'
      )

      // Regular strings (double and single quoted)
      escaped = escaped.replace(
        /(".*?"|'.*?'|&quot;.*?&quot;)/g,
        '<span class="tok-string">$1</span>'
      )

      // Function definitions: def func_name
      escaped = escaped.replace(
        /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="tok-keyword">$1</span> <span class="tok-fn">$2</span>'
      )

      // Python keywords
      const keywords =
        /\b(return|pass|if|else|elif|for|in|while|break|continue|and|or|not|is|import|from|as|class|try|except|finally|raise|with|lambda|yield|async|await|None|True|False)\b/g
      escaped = escaped.replace(keywords, '<span class="tok-keyword">$1</span>')

      // Built-in functions
      const builtins =
        /\b(print|len|range|sum|min|max|abs|map|filter|list|dict|set|int|str|float|bool|type|enumerate|zip)\b/g
      escaped = escaped.replace(builtins, '<span class="tok-builtin">$1</span>')

      // Numbers
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>')

      return escaped + commentPart
    })
    .join('\n')
}

export default function WorkspaceCodeEditor({
  value,
  onChange,
  filename,
  language = 'Python 3',
  onReset,
}: WorkspaceCodeEditorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 5, col: 9 })
  const [copied, setCopied] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => value.split('\n'), [value])
  const highlightedCode = useMemo(() => highlightPython(value), [value])

  const updateCursorPos = () => {
    if (!textareaRef.current) return
    const selStart = textareaRef.current.selectionStart
    const textBefore = value.substring(0, selStart)
    const linesBefore = textBefore.split('\n')
    const currentLine = linesBefore.length
    const currentCol = linesBefore[linesBefore.length - 1].length + 1
    setCursorPos({ line: currentLine, col: currentCol })
  }

  useEffect(() => {
    if (!textareaRef.current) return
    const selStart = textareaRef.current.selectionStart
    const textBefore = value.substring(0, selStart)
    const linesBefore = textBefore.split('\n')
    const currentLine = linesBefore.length
    const currentCol = linesBefore[linesBefore.length - 1].length + 1
    setCursorPos({ line: currentLine, col: currentCol })
  }, [value])

  // Synchronize scrolling between textarea, highlighted pre, and line numbers
  const handleScroll = () => {
    if (!textareaRef.current) return
    const { scrollTop, scrollLeft } = textareaRef.current
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const updated = value.substring(0, start) + '    ' + value.substring(end)
      onChange(updated)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4
        updateCursorPos()
      })
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="ws-editor">
      {/* Top Header: </> Code, Language Selector, Actions */}
      <div className="ws-editor__top-bar">
        <div className="ws-editor__title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            width="15"
            height="15"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Code</span>
        </div>

        <div className="ws-editor__actions">
          {/* Language selector */}
          <div className="ws-editor__lang-selector">
            <button
              type="button"
              className="ws-editor__lang-btn"
              onClick={() => setLangMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
            >
              <span>{selectedLanguage}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                width="12"
                height="12"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {langMenuOpen && (
              <ul className="ws-editor__lang-menu" role="listbox">
                {LANGUAGES.map((lang) => (
                  <li
                    key={lang}
                    role="option"
                    aria-selected={lang === selectedLanguage}
                    className={[
                      'ws-editor__lang-option',
                      lang === selectedLanguage ? 'ws-editor__lang-option--active' : '',
                    ].join(' ')}
                    onClick={() => {
                      setSelectedLanguage(lang)
                      setLangMenuOpen(false)
                    }}
                  >
                    {lang}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action icon buttons */}
          <button
            type="button"
            className="ws-editor__icon-btn"
            title="Reset code"
            aria-label="Reset code"
            onClick={onReset}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              width="15"
              height="15"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            type="button"
            className="ws-editor__icon-btn"
            title={copied ? 'Copied!' : 'Copy code'}
            aria-label="Copy code"
            onClick={handleCopy}
          >
            {copied ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                width="15"
                height="15"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                width="15"
                height="15"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="ws-editor__icon-btn"
            title="Fullscreen"
            aria-label="Toggle fullscreen"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              width="15"
              height="15"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sub-bar: filename on left, draft saved locally on right */}
      <div className="ws-editor__file-bar">
        <span className="ws-editor__filename">{filename}</span>
        <span className="ws-editor__saved-status">Draft saved locally</span>
      </div>

      {/* Main editor area with line numbers, code highlighting & textarea */}
      <div className="ws-editor__canvas">
        {/* Line numbers column */}
        <div ref={lineNumbersRef} className="ws-editor__gutter" aria-hidden="true">
          {lines.map((_, i) => (
            <div
              key={i}
              className={[
                'ws-editor__line-num',
                cursorPos.line === i + 1 ? 'ws-editor__line-num--active' : '',
              ].join(' ')}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor editing container */}
        <div className="ws-editor__stage">
          {/* Active line background bar */}
          <div
            className="ws-editor__active-line-bg"
            style={{
              top: `${(cursorPos.line - 1) * 22 + 10}px`,
            }}
          />

          {/* Highlighted syntax display */}
          <pre
            ref={preRef}
            className="ws-editor__highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
          />

          {/* Interactive textarea */}
          <textarea
            ref={textareaRef}
            className="ws-editor__textarea"
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              updateCursorPos()
            }}
            onKeyUp={updateCursorPos}
            onClick={updateCursorPos}
            onSelect={updateCursorPos}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Code editor"
          />
        </div>
      </div>

      {/* Editor status footer: Spaces: 4 | Ln X, Col Y */}
      <div className="ws-editor__footer">
        <span>Spaces: 4</span>
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      </div>
    </div>
  )
}
