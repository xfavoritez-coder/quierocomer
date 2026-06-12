'use client'

type Tab = 'feed' | 'explorar' | 'guardados' | 'perfil'

export default function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 50, display: 'flex', justifyContent: 'center',
      paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', gap: 6, padding: '6px',
        borderRadius: 20,
        background: 'rgba(20, 20, 20, 0.65)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        pointerEvents: 'auto',
      }}>
        {([
          { id: 'feed' as Tab, label: 'Para ti', icon: '🔥' },
          { id: 'explorar' as Tab, label: 'Explorar', icon: '🧭' },
        ]).map(tab => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === active && tab.id === 'feed') {
                  window.location.reload()
                } else {
                  window.scrollTo(0, 0)
                  onChange(tab.id)
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '10px 22px', borderRadius: 14,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(244,166,35,0.2), rgba(244,166,35,0.08))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(244,166,35,0.25)'
                  : '1px solid transparent',
                cursor: 'pointer',
                color: isActive ? '#F4A623' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.25s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, letterSpacing: '-0.2px' }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
