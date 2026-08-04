import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const QC_LOGO = 'https://quierocomer.com/logo.png'

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
  const meta = [category, commune].filter(Boolean).join(' · ')

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#FAFAF8',
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#F4A623', display: 'flex' }} />

        {/* Subtle background circle */}
        <div style={{
          position: 'absolute', right: -80, top: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,166,35,0.06) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Left: logo */}
        <div style={{
          width: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              width={140}
              height={140}
              style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(0,0,0,0.08)' }}
            />
          ) : (
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F4A623, #e8920f)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48, fontWeight: 800, color: '#0a0a0a',
            }}>
              {name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 280, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

        {/* Right: info */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 64px',
        }}>
          {meta && (
            <div style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#F4A623',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {meta}
            </div>
          )}
          <div style={{
            fontSize: name.length > 20 ? 58 : 72,
            fontWeight: 800,
            color: '#111',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}>
            {name}
          </div>
          <div style={{
            marginTop: 28,
            fontSize: 22,
            color: 'rgba(0,0,0,0.35)',
            fontWeight: 500,
          }}>
            quierocomer.com/{restaurantSlug}
          </div>
        </div>

        {/* QC branding bottom left */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F4A623' }} />
          <div style={{ fontSize: 15, color: 'rgba(0,0,0,0.25)', fontWeight: 600, letterSpacing: '0.07em' }}>
            QUIEROCOMER.COM
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
