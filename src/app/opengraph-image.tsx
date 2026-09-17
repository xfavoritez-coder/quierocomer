import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#FAFAF8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#F4A623', display: 'flex' }} />

        {/* Subtle bg circle */}
        <div style={{
          position: 'absolute',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,166,35,0.07) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://quierocomer.com/logo.png"
          width={120}
          height={120}
          style={{ objectFit: 'contain', marginBottom: 28 }}
        />

        {/* Brand name */}
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 72,
          fontWeight: 700,
          color: '#e8930a',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          QuieroComer
        </div>

        {/* Tagline */}
        <div style={{
          marginTop: 20,
          fontSize: 26,
          color: 'rgba(0,0,0,0.38)',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          Carta digital QR para restaurantes
        </div>

        {/* Bottom branding */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F4A623' }} />
          <div style={{ fontSize: 15, color: 'rgba(0,0,0,0.22)', fontWeight: 600, letterSpacing: '0.07em' }}>
            QUIEROCOMER.COM
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
