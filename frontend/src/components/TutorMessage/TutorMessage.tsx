import type { ReactNode } from 'react'
import { highlightPythonDark } from '../../pages/LessonDetail/utils/highlight'
import './TutorMessage.css'

interface TutorMessageProps {
  text: string
}

function renderPlainText(text: string) {
  return text.replace(/<=/g, '≤')
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g)

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{renderPlainText(part.slice(2, -2))}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={index}>{renderPlainText(part.slice(2, -2))}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code className="tutor-message__inline-code" key={index}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{renderPlainText(part.slice(1, -1))}</em>
    }
    return renderPlainText(part)
  })
}

export default function TutorMessage({ text }: TutorMessageProps) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^\s*```([\w+-]*)\s*$/)
    if (fence) {
      const language = fence[1]
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        <pre className="tutor-message__code" key={`code-${blocks.length}`}>
          {language.toLowerCase() === 'python' ? (
            <code dangerouslySetInnerHTML={{ __html: highlightPythonDark(codeLines.join('\n')) }} />
          ) : (
            <code data-language={language || undefined}>{codeLines.join('\n')}</code>
          )}
        </pre>,
      )
      continue
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      blocks.push(<h4 key={`heading-${blocks.length}`}>{renderInline(heading[1])}</h4>)
      index += 1
      continue
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (numbered) {
      const items: ReactNode[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
        if (!item) break
        items.push(<li key={items.length}>{renderInline(item[1])}</li>)
        index += 1
      }
      blocks.push(<ol key={`list-${blocks.length}`}>{items}</ol>)
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/)
    if (bullet) {
      const items: ReactNode[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.+)$/)
        if (!item) break
        items.push(<li key={items.length}>{renderInline(item[1])}</li>)
        index += 1
      }
      blocks.push(<ul key={`list-${blocks.length}`}>{items}</ul>)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim()) {
      if (index > 0 && /^\s*```/.test(lines[index])) break
      if (/^#{1,3}\s+/.test(lines[index]) || /^\s*(?:\d+[.)]|[-*+])\s+/.test(lines[index])) break
      paragraph.push(lines[index].trim())
      index += 1
    }
    if (paragraph.length) {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInline(paragraph.join(' '))}</p>)
    } else {
      index += 1
    }
  }

  return <div className="tutor-message">{blocks}</div>
}
