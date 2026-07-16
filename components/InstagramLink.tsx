import { INSTAGRAM_URL } from '@/lib/site-config'

export function InstagramLink({ className }: { className?: string }) {
  return (
    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={className}>
      Follow us on Instagram
    </a>
  )
}
