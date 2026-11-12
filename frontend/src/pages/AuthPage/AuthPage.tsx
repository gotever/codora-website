import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import './AuthPage.css'

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Email hoặc username đã được sử dụng.'
    if (error.status === 401) return 'Email hoặc mật khẩu không chính xác.'
    if (error.status === 422) return 'Thông tin chưa đúng yêu cầu. Hãy kiểm tra lại các trường.'
    if (error.status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
    return error.message
  }
  return 'Không thể kết nối máy chủ. Hãy kiểm tra kết nối và thử lại.'
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const { user, loading, login, register } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const destination = from?.pathname ? `${from.pathname}${from.search ?? ''}` : '/learning'
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <main className="auth-page" aria-busy="true"><p className="auth-loading">Đang kiểm tra phiên đăng nhập…</p></main>
  if (user) return <Navigate to={destination} replace />

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Hãy nhập địa chỉ email hợp lệ.')
    if (!password || password.length > 128) return setError('Hãy nhập mật khẩu hợp lệ (tối đa 128 ký tự).')
    if (isRegister) {
      if (fullName.trim().length < 1 || fullName.length > 160) return setError('Họ tên cần có từ 1 đến 160 ký tự.')
      if (username.length < 3 || username.length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username)) return setError('Username cần dài 3–64 ký tự và chỉ gồm chữ, số, dấu _, . hoặc -.')
      if (password.length < 12 || password.length > 128) return setError('Mật khẩu cần có từ 12 đến 128 ký tự.')
      if (password !== confirmation) return setError('Mật khẩu xác nhận không khớp.')
    }
    setBusy(true)
    const operation = isRegister
      ? register({ full_name: fullName.trim(), username, email: email.trim(), password })
      : login(email.trim(), password)
    void operation.then(() => navigate(destination, { replace: true })).catch((reason: unknown) => setError(errorMessage(reason))).finally(() => setBusy(false))
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-heading">
        <Link to="/" className="auth-brand" aria-label="Codora trang chủ"><span className="auth-brand__icon" aria-hidden="true">&gt;_</span><span>Codora</span></Link>
        <h1 id="auth-heading">{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="auth-description">{isRegister ? 'Bắt đầu hành trình học tập cùng Codora.' : 'Tiếp tục hành trình học tập cùng Codora.'}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          {isRegister && <>
            <label>Họ và tên<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={160} /></label>
            <label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={64} /></label>
          </>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Mật khẩu<span className="auth-password"><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} />
            <button type="button" className="auth-reveal" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? 'Ẩn' : 'Hiện'}</button></span></label>
          {isRegister && <>
            <p className="auth-hint">Mật khẩu cần từ 12 đến 128 ký tự.</p>
            <label>Xác nhận mật khẩu<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required maxLength={128} /></label>
          </>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Đăng nhập' : 'Tạo tài khoản'}</Link></p>
      </section>
    </main>
  )
}
