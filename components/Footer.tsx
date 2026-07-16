import { InstagramLink } from './InstagramLink'

export function Footer() {
  return (
    <footer className="site-footer">
      <InstagramLink className="footer-instagram-link" />
      <p>© {new Date().getFullYear()} El Club! · La Pedriza, Manzanares El Real</p>
    </footer>
  )
}
