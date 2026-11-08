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
  runPython: (code: string) => Promise<PyodideResult>
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
    async (code: string): Promise<PyodideResult> => {
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

      // Set up stdout/stderr capture
      pyodide.runPython(`
import sys, io
__stdout_capture = io.StringIO()
__stderr_capture = io.StringIO()
sys.stdout = __stdout_capture
sys.stderr = __stderr_capture
`)

      try {
        const result = pyodide.runPython(code)
        const elapsed = performance.now() - start

        const stdout = pyodide.runPython('__stdout_capture.getvalue()')
        const stderr = pyodide.runPython('__stderr_capture.getvalue()')

        // Restore stdout/stderr
        pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`)

        return {
          success: true,
          output: stdout || '',
          error: stderr || '',
          returnValue: result !== undefined && result !== null
            ? String(result)
            : null,
          executionTime: Math.round(elapsed),
        }
      } catch (err: any) {
        const elapsed = performance.now() - start

        // Try to capture any partial stdout
        let stdout = ''
        try {
          stdout = pyodide.runPython('__stdout_capture.getvalue()')
        } catch {
          // ignore
        }

        // Restore stdout/stderr
        try {
          pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`)
        } catch {
          // ignore
        }

        const rawError = err?.message || String(err)
        const cleanError = cleanPythonError(rawError)

        return {
          success: false,
          output: stdout,
          error: cleanError,
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

/** Extract the last meaningful line(s) from a Python traceback */
function cleanPythonError(raw: string): string {
  const lines = raw.split('\n').filter((l) => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[A-Z]\w*(Error|Exception|Warning):/.test(lines[i].trim())) {
      return lines.slice(i).join('\n')
    }
  }
  return lines.slice(-5).join('\n')
}
