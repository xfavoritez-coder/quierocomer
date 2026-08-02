import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 300, height: 300 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 300,
          height: 300,
          background: '#fbf6ec',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://quierocomer.com/logo.png"
          width={100}
          height={100}
          style={{ objectFit: 'contain' }}
        />
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          color: '#e8930a',
          letterSpacing: '-0.01em',
        }}>
          QuieroComer
        </span>
      </div>
    ),
    { width: 300, height: 300 }
  )
}
