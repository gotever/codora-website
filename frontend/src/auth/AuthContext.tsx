import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest, register as registerRequest, type AuthUser } from '../lib/api'
import { AuthContext } from './authContextValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try { setUser(await fetchCurrentUser()) }
    catch { setUser(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await loginRequest(email, password)
    setUser(await fetchCurrentUser())
  }, [])

  const register = useCallback(async (input: { email: string; username: string; password: string; full_name: string }) => {
    await registerRequest(input)
    setUser(await fetchCurrentUser())
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
