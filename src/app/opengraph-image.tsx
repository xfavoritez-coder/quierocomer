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
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://quierocomer.cl/logo.png"
          width={220}
          height={220}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { width: 300, height: 300 }
  )
}
