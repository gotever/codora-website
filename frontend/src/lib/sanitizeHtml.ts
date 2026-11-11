const ALLOWED_TAGS = new Set(['B', 'STRONG', 'EM', 'I', 'CODE', 'PRE', 'BR', 'P', 'UL', 'OL', 'LI', 'A'])

export function sanitizeHtml(input: string): string {
  const document = new DOMParser().parseFromString(input, 'text/html')
  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof Element) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent ?? ''))
          continue
        }
        const href = child.tagName === 'A' ? child.getAttribute('href') : null
        for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name)
        if (href && /^(https?:|mailto:)/i.test(href)) {
          child.setAttribute('href', href)
          child.setAttribute('rel', 'noopener noreferrer')
        }
        visit(child)
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove()
      }
    }
  }
  visit(document.body)
  return document.body.innerHTML
}
