import './Navbar.css'

const NAV_LINKS = [
  { label: 'Learning', href: '#' },
  { label: 'Exercises', href: '#' },
]

export default function Navbar() {
  return (
    <header className="navbar" role="banner">
      <div className="navbar__inner">
        {/* Logo */}
        <a href="/" className="navbar__logo" aria-label="Codora home">
          <div className="navbar__logo-icon" aria-hidden="true">
            &gt;_
          </div>
          <span className="navbar__logo-name">Codora</span>
        </a>

        {/* Navigation */}
        <nav className="navbar__nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="navbar__nav-link"
            >
              {link.label}
            </a>
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
