'use client'

export function VeganIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <circle cx="12" cy="12" r="12" fill="#4CAF50"/>
      <path fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" d="M12 19v-7"/>
      <path fill="#fff" stroke="none" d="M12 12a5 5 0 0 0-5-5c0 2.76 2.24 5 5 5z"/>
      <path fill="#fff" stroke="none" d="M12 12a5 5 0 0 1 5-5c0 2.76-2.24 5-5 5z"/>
      <path fill="#fff" stroke="none" d="M12 16a4 4 0 0 0-4-4c0 2.21 1.79 4 4 4z"/>
      <path fill="#fff" stroke="none" d="M12 16a4 4 0 0 1 4-4c0 2.21-1.79 4-4 4z"/>
    </svg>
  )
}

export function VegetarianIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <circle cx="12" cy="12" r="12" fill="#66BB6A"/>
      <path fill="#fff" stroke="none" d="M12 19c0 0-7-4.5-7-10 0-3.87 3.13-7 7-7s7 3.13 7 7c0 5.5-7 10-7 10z"/>
      <path fill="none" stroke="#66BB6A" strokeWidth="1.5" strokeLinecap="round" d="M12 19V9"/>
    </svg>
  )
}

export function SpicyIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="12" fill="#FF5722"/>
      <path fill="#fff" stroke="none" d="M12 5C11 3.5 9 4 9 6c0 1 .5 2 1.5 2.5C8.5 9.5 7 11.5 7 14c0 3.31 2.69 5 5 5s5-1.69 5-5c0-2.5-1.5-4.5-3.5-5.5C14.5 8 15 7 15 6c0-2-2-2.5-3-1z"/>
    </svg>
  )
}
