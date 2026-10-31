import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <p className="footer__left">
          Codora · A little practice. A lot of possibility.
        </p>
        <div className="footer__right">
          Built for Python 3
          <span className="footer__code-tag" aria-hidden="true">&lt;/&gt;</span>
        </div>
      </div>
    </footer>
  )
}
