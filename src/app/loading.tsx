export default function RootLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rsk-shimmer {
          background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .rsk-wrap {
          max-width: 480px; margin: 0 auto; min-height: 100dvh;
          background: #f5f4f1; padding: 10px 16px;
        }
        .rsk-topbar { display: none; }
        .rsk-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .rsk-search { height: 40px; border-radius: 14px; background: rgba(0,0,0,0.06); margin-bottom: 16px; }
        .rsk-cols { display: flex; gap: 10px; }
        .rsk-col { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .rsk-col-extra { display: none; flex: 1; flex-direction: column; gap: 10px; }
        @media (min-width: 768px) {
          .rsk-topbar {
            display: flex; position: fixed; top: 0; left: 0; right: 0;
            height: 64px; background: rgba(245,244,241,0.95);
            backdrop-filter: blur(12px); z-index: 100;
            align-items: center; padding: 0 20px; gap: 16px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
          }
          .rsk-wrap { max-width: 1100px; padding: 82px 16px 10px; }
          .rsk-header { display: none; }
          .rsk-search { display: none; }
          .rsk-col-extra { display: flex; }
        }
      `}</style>

      {/* Desktop topbar skeleton */}
      <div className="rsk-topbar">
        <div style={{ width: 120, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.07)', flexShrink: 0 }} />
        <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', height: 38, borderRadius: 20, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', flexShrink: 0, marginLeft: 'auto' }} />
      </div>

      <div className="rsk-wrap">
        {/* Mobile header skeleton */}
        <div className="rsk-header">
          <div style={{ width: 140, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        </div>
        {/* Mobile search skeleton */}
        <div className="rsk-search" />
        {/* Cards */}
        <div className="rsk-cols">
          <div className="rsk-col">
            {(['3/4', '1/1', '4/5'] as const).map((r, i) => (
              <div key={i} className="rsk-shimmer" style={{ aspectRatio: r, borderRadius: 14 }} />
            ))}
          </div>
          <div className="rsk-col">
            {(['1/1', '4/5', '3/4'] as const).map((r, i) => (
              <div key={i} className="rsk-shimmer" style={{ aspectRatio: r, borderRadius: 14 }} />
            ))}
          </div>
          <div className="rsk-col-extra">
            {(['4/5', '3/4', '1/1'] as const).map((r, i) => (
              <div key={i} className="rsk-shimmer" style={{ aspectRatio: r, borderRadius: 14 }} />
            ))}
          </div>
          <div className="rsk-col-extra">
            {(['1/1', '4/5', '3/4'] as const).map((r, i) => (
              <div key={i} className="rsk-shimmer" style={{ aspectRatio: r, borderRadius: 14 }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
