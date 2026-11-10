// Tokenizer for Python syntax highlighting on dark backgrounds

export function highlightPythonDark(code: string): string {
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
        commentPart = `<span class="dark-tok-comment">${escaped.slice(commentIdx)}</span>`
        escaped = escaped.slice(0, commentIdx)
      }

      // Triple quoted strings
      escaped = escaped.replace(
        /(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|"""[\s\S]*?"""|'''[\s\S]*?''')/g,
        '<span class="dark-tok-string">$1</span>'
      )

      // Regular strings (double and single quoted)
      escaped = escaped.replace(
        /(".*?"|'.*?'|&quot;.*?&quot;)/g,
        '<span class="dark-tok-string">$1</span>'
      )

      // Function definitions: def func_name
      escaped = escaped.replace(
        /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="dark-tok-keyword">$1</span> <span class="dark-tok-fn">$2</span>'
      )

      // Python keywords
      const keywords =
        /\b(return|pass|if|else|elif|for|in|while|break|continue|and|or|not|is|import|from|as|class|try|except|finally|raise|with|lambda|yield|async|await|None|True|False)\b/g
      escaped = escaped.replace(keywords, '<span class="dark-tok-keyword">$1</span>')

      // Built-in functions
      const builtins =
        /\b(print|len|range|sum|min|max|abs|map|filter|list|dict|set|int|str|float|bool|type|enumerate|zip)\b/g
      escaped = escaped.replace(builtins, '<span class="dark-tok-builtin">$1</span>')

      // Numbers
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="dark-tok-number">$1</span>')

      return escaped + commentPart
    })
    .join('\n')
}

