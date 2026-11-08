import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// Bundle Monaco locally with Vite
// Monaco runs synchronously and reliably with zero external CDN dependencies
loader.config({ monaco })
