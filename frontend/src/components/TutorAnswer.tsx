import './TutorAnswer.css'

interface TutorAnswerProps {
  text: string
  className?: string
}

function renderInline(text: string, keyPrefix: string) {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g
  const nodes = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokens.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${match.index}`
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes.map((node, index) => typeof node === 'string'
    ? node.split('\n').flatMap((line, lineIndex) => lineIndex === 0
      ? [line]
      : [<br key={`${keyPrefix}-br-${index}-${lineIndex}`} />, line])
    : node)
}

function isListLine(line: string) {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)
}

export default function TutorAnswer({ text, className = '' }: TutorAnswerProps) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^\s*```([\w+-]*)\s*$/)
    if (fence) {
      const codeLines = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        <pre className="tutor-answer__code-block" key={`code-${index}`}>
          {fence[1] && <span className="tutor-answer__language">{fence[1]}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      blocks.push(<h4 className="tutor-answer__heading" key={`heading-${index}`}>{renderInline(heading[1], `heading-${index}`)}</h4>)
      index += 1
      continue
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items = []
      while (index < lines.length && isListLine(lines[index]) === true) {
        const currentOrdered = /^\s*\d+[.)]\s+/.test(lines[index])
        if (currentOrdered !== ordered) break
        items.push(lines[index].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ''))
        index += 1
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List className="tutor-answer__list" key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>)}
        </List>,
      )
      continue
    }

    const paragraph = []
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^#{1,6}\s+/.test(lines[index]) && !isListLine(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(<p className="tutor-answer__paragraph" key={`paragraph-${index}`}>{renderInline(paragraph.join('\n'), `paragraph-${index}`)}</p>)
  }

  return <div className={`tutor-answer ${className}`.trim()}>{blocks}</div>
}
