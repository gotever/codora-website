import { Fragment, useMemo } from 'react'
import { highlightPythonDark } from '../../LessonDetail/utils/highlight'

type PromptSegment =
  | { type: 'prose'; content: string }
  | { type: 'code'; content: string; language?: string }

const PYTHON_CODE_LINE_RE =
  /^(?:\s{2,}\S|def\s+\w+\s*\(|class\s+\w+|for\s+.+:\s*$|while\s+.+:\s*$|if\s+.+:\s*$|elif\s+.+:\s*$|else\s*:\s*$|try\s*:\s*$|except\b.*:\s*$|finally\s*:\s*$|with\s+.+:\s*$|return\b|import\s+\w+|from\s+\w+\s+import\b|print\s*\(|#\s|[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\[[^\]]+\])?\s*[+\-*/]?=\s*.+)/

function isLikelyCodeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Avoid treating plain numbered/bulleted sentences or Input/Output prose labels as code.
  if (/^(?:Example|Input|Output|Constraints?|Note|Expected)\b\s*:/i.test(trimmed)) return false
  if (/^\d+\.\s+[A-Z]/.test(trimmed)) return false
  return PYTHON_CODE_LINE_RE.test(line)
}

function splitUnfencedCode(text: string): PromptSegment[] {
  const lines = text.split('\n')
  const segments: PromptSegment[] = []
  let i = 0

  while (i < lines.length) {
    if (isLikelyCodeLine(lines[i])) {
      let j = i + 1
      while (j < lines.length) {
        if (isLikelyCodeLine(lines[j])) {
          j++
          continue
        }
        // Keep single blank lines inside a multi-line code block if followed by another code line.
        if (!lines[j].trim() && j + 1 < lines.length && isLikelyCodeLine(lines[j + 1])) {
          j++
          continue
        }
        break
      }

      const codeLines = lines.slice(i, j)
      const nonEmptyCount = codeLines.filter((l) => l.trim().length > 0).length
      const hasStrongCodeCue = codeLines.some(
        (l) => /^\s{2,}/.test(l) || /^(?:def |for |while |if |elif |else:|return\b|print\(|import |from |class )/.test(l.trim()),
      )

      if (nonEmptyCount >= 2 && hasStrongCodeCue) {
        segments.push({ type: 'code', content: codeLines.join('\n').replace(/\n+$/, ''), language: 'Python' })
        i = j
        continue
      }
    }

    const proseLines: string[] = []
    while (i < lines.length) {
      if (isLikelyCodeLine(lines[i])) {
        let j = i + 1
        while (j < lines.length && (isLikelyCodeLine(lines[j]) || (!lines[j].trim() && j + 1 < lines.length && isLikelyCodeLine(lines[j + 1])))) {
          j++
        }
        const candidate = lines.slice(i, j)
        const nonEmpty = candidate.filter((l) => l.trim().length > 0).length
        const strong = candidate.some(
          (l) => /^\s{2,}/.test(l) || /^(?:def |for |while |if |elif |else:|return\b|print\(|import |from |class )/.test(l.trim()),
        )
        if (nonEmpty >= 2 && strong) break
      }
      proseLines.push(lines[i])
      i++
    }
    const prose = proseLines.join('\n').trim()
    if (prose) segments.push({ type: 'prose', content: prose })
  }

  return segments
}

function parsePromptSegments(prompt: string): PromptSegment[] {
  const normalized = prompt.replace(/\r\n/g, '\n')
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  const segments: PromptSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fenceRegex.exec(normalized)) !== null) {
    const before = normalized.slice(lastIndex, match.index).trim()
    if (before) {
      segments.push(...splitUnfencedCode(before))
    }
    segments.push({
      type: 'code',
      language: match[1] ? match[1] : 'Python',
      content: match[2].replace(/\n+$/, ''),
    })
    lastIndex = match.index + match[0].length
  }

  const tail = normalized.slice(lastIndex).trim()
  if (tail) {
    segments.push(...splitUnfencedCode(tail))
  }

  return segments.length > 0 ? segments : [{ type: 'prose', content: normalized }]
}

export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code key={index} className="exam-inline-code">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}

function ExamCodeBlock({ code, language }: { code: string; language?: string }) {
  const lines = useMemo(() => code.split('\n'), [code])
  const highlighted = useMemo(() => highlightPythonDark(code), [code])

  return (
    <div className="exam-code-block">
      <div className="exam-code-block__header">
        <span className="exam-code-block__lang">{language || 'Python'}</span>
      </div>
      <div className="exam-code-block__body">
        <div className="exam-code-block__gutter" aria-hidden="true">
          {lines.map((_, idx) => (
            <span key={idx} className="exam-code-block__line-num">
              {idx + 1}
            </span>
          ))}
        </div>
        <pre className="exam-code-block__pre">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

export default function PromptRenderer({ prompt }: { prompt: string }) {
  const segments = useMemo(() => parsePromptSegments(prompt), [prompt])

  return (
    <div className="exam-prompt">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return <ExamCodeBlock key={index} code={segment.content} language={segment.language} />
        }
        const paragraphs = segment.content.split(/\n{2,}/)
        return paragraphs.map((para, pIdx) => (
          <p key={`${index}-${pIdx}`} className="exam-prompt__paragraph">
            <InlineText text={para.trim()} />
          </p>
        ))
      })}
    </div>
  )
}
