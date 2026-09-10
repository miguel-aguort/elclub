import { INSTAGRAM_URL } from '@/lib/site-config'

export function Header() {
  return (
    <header className="site-header">
      <a href="#hero" className="brand">
        <span className="brand-word">El Club!</span>
        <span className="brand-rule" aria-hidden="true" />
      </a>
      <nav className="site-nav">
        <a href="#actividades">Actividades</a>
        <a href="#proximas-actividades">Agenda</a>
        <a href="#montana">La Montaña</a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
        <a href="#unete" className="nav-cta">
          Únete
        </a>
      </nav>
    </header>
  )
}
