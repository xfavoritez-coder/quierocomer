import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ restaurantSlug: string }> }

export default async function Image({ params }: Props) {
  const { restaurantSlug } = await params

  const r = await prisma.restaurant.findFirst({
    where: { slug: restaurantSlug, isActive: true },
    select: { name: true, logoUrl: true, primaryCategory: true, commune: true },
  })

  const name = r?.name ?? 'QuieroComer'
  const category = r?.primaryCategory ?? ''
  const commune = r?.commune ?? ''
  const logoUrl = r?.logoUrl ?? null

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: 'linear-gradient(145deg, #111111 0%, #1a1a1a 60%, #0e0e0e 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(244,166,35,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(244,166,35,0.04) 0%, transparent 50%)',
          display: 'flex',
        }} />

        {/* Logo circle */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            width={120}
            height={120}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.12)', marginBottom: 28 }}
          />
        ) : (
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F4A623, #e8920f)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 42, fontWeight: 800, color: '#0a0a0a',
            marginBottom: 28,
          }}>
            {name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Restaurant name */}
        <div style={{
          fontSize: name.length > 22 ? 52 : 64,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          textAlign: 'center',
          maxWidth: 900,
          marginBottom: 16,
        }}>
          {name}
        </div>

        {/* Category / commune */}
        {(category || commune) && (
          <div style={{
            fontSize: 26,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em',
            marginBottom: 0,
          }}>
            {[category, commune].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* QC branding bottom */}
        <div style={{
          position: 'absolute',
          bottom: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#F4A623',
          }} />
          <div style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}>
            QUIEROCOMER.COM
          </div>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#F4A623',
          }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
