import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ restaurantSlug: string }> }

export default async function Image({ params }: Props) {
  const { restaurantSlug } = await params

  let r: { name: string; logoUrl: string | null; primaryCategory: string | null; commune: string | null } | null = null
  try {
    r = await prisma.restaurant.findFirst({
      where: { slug: restaurantSlug, OR: [{ isActive: true }, { isDemo: true }] },
      select: { name: true, logoUrl: true, primaryCategory: true, commune: true },
    })
  } catch { /* DB unavailable — render branded fallback */ }

  const name = r?.name?.trim() ?? 'QuieroComer'
  const category = r?.primaryCategory ?? ''
  const commune = r?.commune ?? ''
  const logoUrl = r?.logoUrl ?? null
  const meta = [category, commune].filter(Boolean).join(' · ')

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0E0E0E',
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          padding: '0 80px',
          gap: 56,
        }}
      >
        {/* Subtle warm glow top-right */}
        <div style={{
          position: 'absolute', right: -100, top: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,166,35,0.08) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F4A623', display: 'flex' }} />

        {/* Left: small logo or initials */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              width={88}
              height={88}
              style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(244,166,35,0.3)' }}
            />
          ) : (
            <div style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: '#1A1008',
              border: '2px solid rgba(244,166,35,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: initials.length === 1 ? 42 : 34,
                fontWeight: 800,
                color: '#F4A623',
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}>
                {initials}
              </span>
            </div>
          )}
        </div>

        {/* Thin vertical divider */}
        <div style={{ width: 1, height: 180, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Right: info */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 0,
        }}>
          {meta && (
            <div style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#F4A623',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 18,
            }}>
              {meta}
            </div>
          )}
          <div style={{
            fontSize: name.length > 22 ? 56 : name.length > 14 ? 68 : 80,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
          }}>
            {name}
          </div>
          <div style={{
            marginTop: 24,
            fontSize: 20,
            color: 'rgba(255,255,255,0.25)',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            quierocomer.com/{restaurantSlug}
          </div>
        </div>

        {/* QC dot branding bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F4A623' }} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)', fontWeight: 600, letterSpacing: '0.08em' }}>
            QUIEROCOMER
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
