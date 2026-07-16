import { INSTAGRAM_URL } from '@/lib/site-config'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="footer-word">El Club!</span>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-instagram-link"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" />
          </svg>
          Síguenos en Instagram
        </a>
        <p className="footer-legal">
          © {new Date().getFullYear()} El Club! · La Pedriza, Manzanares El Real
        </p>
      </div>
    </footer>
  )
}
