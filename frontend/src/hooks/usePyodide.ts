import { useState, useEffect, useRef, useCallback } from 'react'

// Local Pyodide bundled in public/ directory (fast & offline)
const LOCAL_PYODIDE_PATH = '/pyodide/'
// CDN fallback
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'

export interface PyodideResult {
  success: boolean
  output: string    // stdout captured during execution
  error: string     // stderr / exception message
  returnValue: string | null  // repr() of the returned value
  executionTime: number       // milliseconds
}

export interface UsePyodideReturn {
  /** Whether Pyodide is still loading */
  isLoading: boolean
  /** Error during Pyodide initialisation */
  loadError: string | null
  /** Run arbitrary Python code and capture output */
  runPython: (code: string, stdin?: string) => Promise<PyodideResult>
  /** Run a function from user code with given arguments, return its repr */
  runTestCase: (
    code: string,
    functionName: string,
    argsExpression: string
  ) => Promise<PyodideResult>
  /** Whether Pyodide has loaded and is ready */
  isReady: boolean
}

// Module-level cache so Pyodide loads once across component re-mounts
let pyodideInstance: any = null
let pyodideLoadPromise: Promise<any> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already added
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function loadPyodideRuntime(): Promise<any> {
  if (pyodideInstance) return pyodideInstance
  if (pyodideLoadPromise) return pyodideLoadPromise

  pyodideLoadPromise = (async () => {
    // 1. Try local pyodide first
    try {
      if (!(window as any).loadPyodide) {
        await loadScript(`${LOCAL_PYODIDE_PATH}pyodide.js`)
      }
      const loadPyodide = (window as any).loadPyodide
      pyodideInstance = await loadPyodide({
        indexURL: LOCAL_PYODIDE_PATH,
      })
      return pyodideInstance
    } catch (localErr) {
      console.warn('Local Pyodide load failed, falling back to CDN...', localErr)
    }

    // 2. Fallback to CDN
    try {
      if (!(window as any).loadPyodide) {
        await loadScript(`${PYODIDE_CDN}pyodide.js`)
      }
      const loadPyodide = (window as any).loadPyodide
      pyodideInstance = await loadPyodide({
        indexURL: PYODIDE_CDN,
      })
      return pyodideInstance
    } catch (cdnErr) {
      console.error('All Pyodide loading attempts failed:', cdnErr)
      throw new Error('Failed to load Python runtime. Please refresh the page.')
    }
  })()

  return pyodideLoadPromise
}

export function usePyodide(): UsePyodideReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const pyodideRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    loadPyodideRuntime()
      .then((pyodide) => {
        if (cancelled) return
        pyodideRef.current = pyodide
        setIsReady(true)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message || 'Failed to load Pyodide')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const runPython = useCallback(
    async (code: string, stdin = ''): Promise<PyodideResult> => {
      const pyodide = pyodideRef.current
      if (!pyodide) {
        return {
          success: false,
          output: '',
          error: 'Pyodide is not loaded yet. Please wait.',
          returnValue: null,
          executionTime: 0,
        }
      }

      const start = performance.now()

      pyodide.globals.set('__codora_code', code)
      pyodide.globals.set('__codora_stdin', stdin)

      try {
        pyodide.runPython(`
import ast, io, sys, traceback

__stdout_capture = io.StringIO()
__stderr_capture = io.StringIO()
__codora_ret = None
__codora_err = ""
__orig_stdout, __orig_stderr, __orig_stdin = sys.stdout, sys.stderr, sys.stdin
sys.stdout = __stdout_capture
sys.stderr = __stderr_capture
sys.stdin = io.StringIO(__codora_stdin)
try:
    __codora_ns = {'__name__': '__main__'}
    __codora_tree = ast.parse(__codora_code, '<solution>', 'exec')
    if __codora_tree.body and isinstance(__codora_tree.body[-1], ast.Expr):
        __codora_last = ast.Expression(__codora_tree.body.pop().value)
        ast.fix_missing_locations(__codora_last)
        if __codora_tree.body:
            exec(compile(__codora_tree, '<solution>', 'exec'), __codora_ns)
        __codora_val = eval(compile(__codora_last, '<solution>', 'eval'), __codora_ns)
        if __codora_val is not None:
            __codora_ret = str(__codora_val)
    else:
        exec(compile(__codora_tree, '<solution>', 'exec'), __codora_ns)
except BaseException:
    __codora_err = traceback.format_exc()
finally:
    sys.stdout = __orig_stdout
    sys.stderr = __orig_stderr
    sys.stdin = __orig_stdin
`)
        const elapsed = performance.now() - start
        const stdout = String(pyodide.globals.get('__stdout_capture').getvalue() || '')
        const stderr = String(pyodide.globals.get('__stderr_capture').getvalue() || '')
        const errText = String(pyodide.globals.get('__codora_err') || '')
        const retVal = pyodide.globals.get('__codora_ret')
        const returnValue = retVal !== undefined && retVal !== null ? String(retVal) : null

        for (const name of [
          '__codora_code',
          '__codora_stdin',
          '__codora_ret',
          '__codora_err',
          '__stdout_capture',
          '__stderr_capture',
        ]) {
          try {
            pyodide.globals.delete(name)
          } catch {
            // ignore cleanup errors
          }
        }

        if (errText) {
          return {
            success: false,
            output: stdout,
            error: cleanPythonError(errText),
            returnValue: null,
            executionTime: Math.round(elapsed),
          }
        }

        return {
          success: true,
          output: stdout,
          error: stderr,
          returnValue,
          executionTime: Math.round(elapsed),
        }
      } catch (err: any) {
        const elapsed = performance.now() - start
        const rawError = err?.message || String(err)
        return {
          success: false,
          output: '',
          error: cleanPythonError(rawError),
          returnValue: null,
          executionTime: Math.round(elapsed),
        }
      }
    },
    []
  )

  const runTestCase = useCallback(
    async (
      code: string,
      functionName: string,
      argsExpression: string
    ): Promise<PyodideResult> => {
      const testScript = `${code}

# --- Codora test runner ---
__test_args = ${argsExpression}
if isinstance(__test_args, tuple):
    __test_result = ${functionName}(*__test_args)
else:
    __test_result = ${functionName}(__test_args)
repr(__test_result)
`
      return runPython(testScript)
    },
    [runPython]
  )

  return {
    isLoading,
    loadError,
    runPython,
    runTestCase,
    isReady,
  }
}

/** Extract the meaningful error message and user code location from a Python traceback */
function cleanPythonError(raw: string): string {
  const lines = raw.split('\n').filter((l) => l.trim())
  const solutionIdx = lines.findLastIndex((l) => l.includes('File "<solution>"'))
  if (solutionIdx !== -1) {
    return lines.slice(solutionIdx).join('\n')
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[A-Z]\w*(Error|Exception|Warning):/.test(lines[i].trim())) {
      return lines.slice(i).join('\n')
    }
  }
  return lines.slice(-5).join('\n')
}
