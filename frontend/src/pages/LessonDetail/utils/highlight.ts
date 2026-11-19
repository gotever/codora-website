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

      // 3. Protect strings and generated markup so later regexes only inspect
      //    source text, never HTML attributes such as class="...".
      const placeholders: string[] = []
      const putPlaceholder = (html: string) => {
        let value = placeholders.length
        let suffix = ''
        do {
          suffix = String.fromCharCode(65 + (value % 26)) + suffix
          value = Math.floor(value / 26) - 1
        } while (value >= 0)
        placeholders.push(html)
        return `__CODORA_TOKEN_${suffix}__`
      }
      escaped = escaped.replace(
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        (match) => putPlaceholder(`<span class="dark-tok-string">${match}</span>`)
      )

      // 4. Function definitions:  def func_name
      escaped = escaped.replace(
        /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        (_match, keyword: string, name: string) => putPlaceholder(
          `<span class="dark-tok-keyword">${keyword}</span> <span class="dark-tok-fn">${name}</span>`
        )
      )

      // 5. Python keywords  (safe — strings are placeholders now)
      escaped = escaped.replace(
        /\b(return|pass|if|else|elif|for|in|while|break|continue|and|or|not|is|import|from|as|class|try|except|finally|raise|with|lambda|yield|async|await|None|True|False)\b/g,
        (_match, keyword: string) => putPlaceholder(`<span class="dark-tok-keyword">${keyword}</span>`)
      )

      // 6. Built-in functions
      escaped = escaped.replace(
        /\b(print|len|range|sum|min|max|abs|map|filter|list|dict|set|int|str|float|bool|type|enumerate|zip)\b/g,
        (_match, builtin: string) => putPlaceholder(`<span class="dark-tok-builtin">${builtin}</span>`)
      )

      // 7. Numbers
      escaped = escaped.replace(/\b(\d+)\b/g, (_match, number: string) =>
        putPlaceholder(`<span class="dark-tok-number">${number}</span>`)
      )

      // 8. Restore highlighted tokens after all regex passes are complete.
      escaped = escaped.replace(/__CODORA_TOKEN_([A-Z]+)__/g, (_match, suffix: string) => {
        const index = [...suffix].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1
        return placeholders[index]
      })

      return escaped + commentPart
    })
    .join('\n')
}
