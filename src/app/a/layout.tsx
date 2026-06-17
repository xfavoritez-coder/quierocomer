import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import './feed.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-feed-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-feed-body',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f4f1',
}

export const metadata: Metadata = {
  title: 'QuieroComer - Descubre que comer cerca de ti',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer - Descubre que comer cerca de ti',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`feed-root ${playfair.variable} ${dmSans.variable} min-h-dvh antialiased`}
      style={{
        background: '#f5f4f1',
        color: '#111111',
        fontFamily: 'var(--font-feed-body), system-ui, -apple-system, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </div>
  )
}
