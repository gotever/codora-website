// Tokenizer for Python syntax highlighting on dark backgrounds
//
// Uses a placeholder technique to avoid regex passes clobbering HTML
// that was inserted by earlier passes (e.g. the keywords regex matching
// the word "class" inside a span's class="..." attribute).

export function highlightPythonDark(code: string): string {
  const lines = code.split('\n')
  return lines
    .map((line) => {
      // 1. Escape HTML entities so we never have raw < > &
      let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      // 2. Peel off trailing comment so it doesn't interfere with string detection.
      //    Walk char-by-char to find a # that is NOT inside a string.
      let commentPart = ''
      let inStr: false | '"' | "'" = false
      for (let i = 0; i < escaped.length; i++) {
        const ch = escaped[i]
        if (!inStr && (ch === '"' || ch === "'")) {
          inStr = ch
        } else if (inStr && ch === inStr) {
          inStr = false
        } else if (!inStr && ch === '#') {
          commentPart = `<span class="dark-tok-comment">${escaped.slice(i)}</span>`
          escaped = escaped.slice(0, i)
          break
        }
      }

      // 3. Extract string literals and replace with safe NUL-delimited placeholders.
      //    This prevents later keyword/builtin regexes from matching text that
      //    appears inside class="..." attributes added by earlier passes.
      const stringPlaceholders: string[] = []
      escaped = escaped.replace(
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        (match) => {
          const idx = stringPlaceholders.length
          stringPlaceholders.push(`<span class="dark-tok-string">${match}</span>`)
          return `\x00STR${idx}\x00`
        }
      )

      // 4. Function definitions:  def func_name
      escaped = escaped.replace(
        /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="dark-tok-keyword">$1</span> <span class="dark-tok-fn">$2</span>'
      )

      // 5. Python keywords  (safe — strings are placeholders now)
      escaped = escaped.replace(
        /\b(return|pass|if|else|elif|for|in|while|break|continue|and|or|not|is|import|from|as|class|try|except|finally|raise|with|lambda|yield|async|await|None|True|False)\b/g,
        '<span class="dark-tok-keyword">$1</span>'
      )

      // 6. Built-in functions
      escaped = escaped.replace(
        /\b(print|len|range|sum|min|max|abs|map|filter|list|dict|set|int|str|float|bool|type|enumerate|zip)\b/g,
        '<span class="dark-tok-builtin">$1</span>'
      )

      // 7. Numbers
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="dark-tok-number">$1</span>')

      // 8. Restore string placeholders with their HTML-wrapped versions
      escaped = escaped.replace(/\x00STR(\d+)\x00/g, (_, idx) => stringPlaceholders[Number(idx)])

      return escaped + commentPart
    })
    .join('\n')
}
