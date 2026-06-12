import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'

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
  themeColor: '#0e0e0e',
}

export const metadata: Metadata = {
  title: 'QuieroComer — Descubre qué comer hoy',
  description: 'Explora platos reales de restaurantes cerca de ti. Encuentra tu próximo antojo.',
  openGraph: {
    title: 'QuieroComer — Descubre qué comer hoy',
    description: 'Explora platos reales de restaurantes cerca de ti.',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} min-h-dvh bg-[#0e0e0e] text-white antialiased`}
      style={{
        fontFamily: 'var(--font-feed-body), system-ui, -apple-system, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </div>
  )
}
