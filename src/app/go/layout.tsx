import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Go — QuieroComer',
  description: 'Board interno del equipo',
  robots: 'noindex, nofollow',
}

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return children
}
