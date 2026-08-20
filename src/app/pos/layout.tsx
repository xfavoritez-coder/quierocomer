import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import PosServiceWorker from './PosServiceWorker'

export const metadata: Metadata = {
  title: 'POS | QuieroComer',
  description: 'Punto de venta QuieroComer',
  manifest: '/pos/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS QuieroComer',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-white text-stone-900 antialiased"
      style={{
        '--font-display': '"Space Grotesk", system-ui, sans-serif',
        '--font-body': '"Inter", system-ui, sans-serif',
      } as React.CSSProperties}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <PosServiceWorker />
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontSize: '0.85rem',
          },
        }}
      />
    </div>
  )
}
