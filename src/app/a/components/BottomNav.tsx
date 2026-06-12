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
    <nav className="feed-nav">
      <div style={{
        maxWidth: 320, margin: '0 auto',
        display: 'flex', gap: 8, padding: '8px 20px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      }}>
        {([
          { id: 'feed' as Tab, label: 'Para ti', icon: '🔥' },
          { id: 'explorar' as Tab, label: 'Explorar', icon: '🧭' },
        ]).map(tab => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => { window.scrollTo(0, 0); onChange(tab.id) }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '10px 0', borderRadius: 12,
                background: isActive ? 'rgba(244,166,35,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(244,166,35,0.2)' : '1px solid transparent',
                cursor: 'pointer',
                color: isActive ? '#F4A623' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
