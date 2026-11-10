import { useMemo } from 'react'
import { highlightPythonDark } from '../../utils/highlight'
import './CodeBlock.css'

interface CodeBlockProps {
  filename?: string
  language?: string
  code: string
  caption?: string
}

export default function CodeBlock({
  filename = 'main.py',
  language = 'Python',
  code,
  caption,
}: CodeBlockProps) {
  const lines = useMemo(() => code.split('\n'), [code])
  const highlighted = useMemo(() => highlightPythonDark(code), [code])

  return (
    <div className="code-block-wrapper">
      <div className="code-block" role="region" aria-label={`Code example: ${filename}`}>
        {/* Header bar */}
        <div className="code-block__header">
          <span className="code-block__filename">{filename}</span>
          <span className="code-block__language">{language}</span>
        </div>

        {/* Content area: gutter with line numbers and code text */}
        <div className="code-block__body">
          <div className="code-block__gutter" aria-hidden="true">
            {lines.map((_, i) => (
              <span key={i} className="code-block__line-num">
                {i + 1}
              </span>
            ))}
          </div>
          <pre
            className="code-block__pre"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      </div>

      {caption && <p className="code-block__caption">{caption}</p>}
    </div>
  )
}

