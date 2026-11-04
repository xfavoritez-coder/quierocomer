import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import PosServiceWorker from './PosServiceWorker'
import PosOrderSound from './components/PosOrderSound'
import './pos.css'

export const metadata: Metadata = {
  title: 'QuieroComer - POS',
  description: 'Punto de venta QuieroComer',
  manifest: '/pos/manifest.json',
  icons: {
    icon: '/pos/icon-192.png',
    shortcut: '/pos/icon-192.png',
    apple: '/pos/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuieroComer POS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F5F4F1',
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="antialiased" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)', height: '100dvh', overflow: 'hidden' }}>
      {/* Fonts + design tokens */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        :root {
          --bg: #F5F4F1;
          --surface: #FFFFFF;
          --sunk: #FAF9F7;
          --ink: #1B1A17;
          --ink-2: #6E6B64;
          --ink-3: #A19D94;
          --line: #EAE8E2;
          --line-strong: #DCD9D1;

          --amber: #DE7C00;
          --amber-press: #B86500;
          --amber-tint: #FBEED6;
          --amber-tint-2: #FDF7EC;

          --jade: #2F8F6B;
          --jade-tint: #E7F1EC;
          --slate: #3B6FB0;
          --slate-tint: #EAF0F8;

          --r-card: 16px;
          --r-btn: 12px;
          --r-chip: 999px;
          --sh-1: 0 1px 2px rgba(27,26,23,.04), 0 1px 3px rgba(27,26,23,.03);
          --sh-2: 0 2px 4px rgba(27,26,23,.05), 0 6px 16px rgba(27,26,23,.06);

          --sans: 'Inter', system-ui, sans-serif;
          --mono: 'IBM Plex Mono', monospace;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Focus visible */
        :focus-visible {
          outline: 2px solid var(--amber);
          outline-offset: 2px;
        }

        /* Bloquea el scroll nativo del browser en mobile — el POS maneja su propio scroll interno */
        html, body {
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }
      `}</style>
      <PosServiceWorker />
      <PosOrderSound />
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: 'var(--sans)',
            fontSize: '0.85rem',
          },
        }}
      />
    </div>
  )
}
