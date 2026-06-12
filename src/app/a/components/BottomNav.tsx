'use client'

type Tab = 'feed' | 'explorar' | 'guardados' | 'perfil'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'feed', label: 'Para ti', icon: '🔥' },
  { id: 'explorar', label: 'Explorar', icon: '🧭' },
  { id: 'guardados', label: 'Guardados', icon: '💾' },
  { id: 'perfil', label: 'Perfil', icon: '👤' },
]

export default function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  return (
    <nav className="feed-nav">
      <div className="feed-nav-inner">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { window.scrollTo(0, 0); onChange(tab.id) }}
            className={`feed-nav-tab ${active === tab.id ? 'active' : ''}`}
          >
            <span className="icon">{tab.icon}</span>
            <span className="label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
