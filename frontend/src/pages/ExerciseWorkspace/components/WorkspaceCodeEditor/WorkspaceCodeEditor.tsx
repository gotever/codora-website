import { useState, useRef, useCallback, useEffect } from 'react'
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react'
import './WorkspaceCodeEditor.css'

interface WorkspaceCodeEditorProps {
  value: string
  onChange: (value: string) => void
  filename: string
  language?: string
  onReset?: () => void
}

export default function WorkspaceCodeEditor({
  value,
  onChange,
  filename,
  onReset,
}: WorkspaceCodeEditorProps) {
  const [copied, setCopied] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [editorReady, setEditorReady] = useState(false)
  const editorRef = useRef<any>(null)

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    try {
      monaco.editor.defineTheme('codora-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '3b5bdb', fontStyle: 'bold' },
          { token: 'keyword.control', foreground: '3b5bdb', fontStyle: 'bold' },
          { token: 'string', foreground: '059669' },
          { token: 'string.escape', foreground: '059669' },
          { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
          { token: 'number', foreground: 'd97706' },
          { token: 'type', foreground: '7c3aed' },
          { token: 'identifier', foreground: '1e293b' },
          { token: 'delimiter', foreground: '64748b' },
          { token: 'delimiter.bracket', foreground: '64748b' },
          { token: 'tag', foreground: '2563eb' },
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#1e293b',
          'editor.lineHighlightBackground': '#3b5bdb10',
          'editor.selectionBackground': '#3b5bdb22',
          'editor.inactiveSelectionBackground': '#3b5bdb11',
          'editorCursor.foreground': '#3b5bdb',
          'editorLineNumber.foreground': '#94a3b8',
          'editorLineNumber.activeForeground': '#1e293b',
          'editorGutter.background': '#fafbfd',
          'editorIndentGuide.background': '#e5e7eb',
          'editorIndentGuide.activeBackground': '#cbd5e1',
        },
      })
    } catch (e) {
      console.warn('Custom Monaco theme definition skipped:', e)
    }
  }, [])

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    setEditorReady(true)

    // Track cursor position
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column })
    })

    // Auto-focus editor
    editor.focus()
  }, [])

  // Update editor value if value prop changes externally (e.g. exercise change or reset)
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value)
    }
  }, [value])

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
      {/* Top Header: </> Code, Actions */}
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
        </div>
      </div>

      {/* Sub-bar: filename on left, draft saved locally on right */}
      <div className="ws-editor__file-bar">
        <span className="ws-editor__filename">{filename}</span>
        <span className="ws-editor__saved-status">Draft saved locally</span>
      </div>

      {/* Monaco Editor Container */}
      <div className="ws-editor__canvas">
        <Editor
          height="360px"
          language="python"
          value={value}
          onChange={(val) => onChange(val ?? '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme="codora-light"
          loading={
            <div className="ws-editor__loading">
              <span className="ws-editor__loading-spinner" />
              <span>Initializing editor…</span>
            </div>
          }
          options={{
            fontSize: 13,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, ui-monospace, monospace",
            fontLigatures: true,
            lineHeight: 22,
            tabSize: 4,
            insertSpaces: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            renderLineHighlight: 'all',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            wordBasedSuggestions: 'currentDocument',
            bracketPairColorization: { enabled: true },
            guides: {
              indentation: true,
              bracketPairs: true,
            },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
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
