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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0e0e0e]/95 backdrop-blur-lg border-t border-white/[0.04]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-[460px] mx-auto flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors active:opacity-70 ${
              active === tab.id
                ? 'text-[#F4A623]'
                : 'text-white/30'
            }`}
          >
            <span className="text-[18px] leading-none">{tab.icon}</span>
            <span className="text-[9px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
