import { InstagramLink } from './InstagramLink'

export function Footer() {
  return (
    <footer>
      <InstagramLink />
      <p>© {new Date().getFullYear()} El Club</p>
    </footer>
  )
}
