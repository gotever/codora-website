import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import './Navbar.css'

const NAV_LINKS = [
  { label: 'Learning', to: '/learning' },
  { label: 'Exercises', to: '/exercises' },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()

  async function handleLogout() {
    try {
      await logout()
      navigate('/', { replace: true })
    } catch {
      // Keep the user state when the server could not confirm session invalidation.
    }
  }

  return (
    <header className="navbar" role="banner">
      <div className="navbar__inner">
        {/* Logo */}
        <NavLink to="/" className="navbar__logo" aria-label="Codora home">
          <div className="navbar__logo-icon" aria-hidden="true">
            &gt;_
          </div>
          <span className="navbar__logo-name">Codora</span>
        </NavLink>

        {/* Navigation */}
        <nav className="navbar__nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => {
            const isLearningActive =
              link.to === '/learning' && location.pathname.startsWith('/lessons')

            return (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) =>
                  [
                    'navbar__nav-link',
                    isActive || isLearningActive ? 'navbar__nav-link--active' : '',
                  ]
                    .join(' ')
                    .trim()
                }
              >
                {link.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Auth actions */}
        {!loading && <div className="navbar__actions">
          {user ? <><span className="navbar__user">{user.full_name}</span><button type="button" className="navbar__btn navbar__btn--login" onClick={handleLogout}>Log out</button></> : <>
            <Link to="/register" className="navbar__btn navbar__btn--signup">Sign up</Link>
            <Link to="/login" state={{ from: { pathname: location.pathname, search: location.search } }} className="navbar__btn navbar__btn--login">Log in</Link>
          </>}
        </div>}
      </div>
    </header>
  )
}
