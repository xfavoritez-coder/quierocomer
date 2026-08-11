import type { Metadata, Viewport } from 'next'
import './feed.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f4f1',
}

export const metadata: Metadata = {
  title: 'QuieroComer - Descubre qué comer cerca de ti',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer - Descubre qué comer cerca de ti',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="feed-root min-h-dvh antialiased"
      style={{
        '--font-feed-display': '"Playfair Display", Georgia, serif',
        '--font-feed-body': '"DM Sans", system-ui, sans-serif',
        background: '#f5f4f1',
        color: '#111111',
        fontFamily: 'var(--font-feed-body), system-ui, -apple-system, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      {children}
    </div>
  )
}
