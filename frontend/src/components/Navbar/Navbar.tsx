import { NavLink } from 'react-router-dom'
import './Navbar.css'

const NAV_LINKS = [
  { label: 'Learning', to: '/learning' },
  { label: 'Exercises', to: '/exercises' },
]

export default function Navbar() {
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
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                ['navbar__nav-link', isActive ? 'navbar__nav-link--active' : ''].join(' ').trim()
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Auth actions */}
        <div className="navbar__actions">
          <button type="button" className="navbar__btn navbar__btn--signup" id="btn-signup">
            Sign up
          </button>
          <button type="button" className="navbar__btn navbar__btn--login" id="btn-login">
            Log in
          </button>
        </div>
      </div>
    </header>
  )
}
