export default function ResenaLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rnl-s {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(160deg, #111 0%, #1c1c1c 60%, #0e0e0e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 20px 60px',
      }}>
        {/* Logo */}
        <div className="rnl-s" style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 16 }} />
        {/* Name */}
        <div className="rnl-s" style={{ width: 140, height: 20, borderRadius: 7, marginBottom: 8 }} />
        {/* Title */}
        <div className="rnl-s" style={{ width: 220, height: 28, borderRadius: 8, marginBottom: 24 }} />
        {/* Stars row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="rnl-s" style={{ width: 36, height: 36, borderRadius: 8 }} />
          ))}
        </div>
        {/* Textarea */}
        <div className="rnl-s" style={{ width: '100%', maxWidth: 400, height: 100, borderRadius: 14, marginBottom: 12 }} />
        {/* Name input */}
        <div className="rnl-s" style={{ width: '100%', maxWidth: 400, height: 52, borderRadius: 14, marginBottom: 16 }} />
        {/* Button */}
        <div className="rnl-s" style={{ width: '100%', maxWidth: 400, height: 52, borderRadius: 14 }} />
      </div>
    </>
  )
}
