'use client'

type Tab = 'inicio' | 'feed' | 'explorar' | 'guardados' | 'perfil'

export default function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  // Single tab — no nav bar needed, just a spacer for bottom safe area
  return null
}
