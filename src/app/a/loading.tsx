export default function FeedLoading() {
  return (
    <>
      <style>{`
        .feed-skeleton-wrap {
          min-height: 100dvh;
          background: #f5f4f1;
          padding: 10px 16px;
          max-width: 480px;
          margin: 0 auto;
        }
        .feed-skeleton-topbar {
          display: none;
        }
        .feed-skeleton-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .feed-skeleton-search {
          height: 40px;
          border-radius: 14px;
          background: rgba(0,0,0,0.06);
          margin-bottom: 16px;
        }
        .feed-skeleton-cols {
          display: flex;
          gap: 10px;
        }
        .feed-skeleton-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .feed-skeleton-col-extra {
          display: none;
          flex: 1;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 768px) {
          .feed-skeleton-topbar {
            display: flex;
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 64px;
            background: rgba(245,244,241,0.95);
            backdrop-filter: blur(12px);
            z-index: 100;
            align-items: center;
            padding: 0 20px;
            gap: 16px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
          }
          .feed-skeleton-wrap {
            max-width: 1100px;
            padding: 74px 16px 10px;
          }
          .feed-skeleton-header {
            display: none;
          }
          .feed-skeleton-search {
            display: none;
          }
          .feed-skeleton-col-extra {
            display: flex;
          }
        }
      `}</style>

      {/* Desktop topbar skeleton */}
      <div className="feed-skeleton-topbar">
        <div style={{ width: 120, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.07)', flexShrink: 0 }} />
        <div style={{ flex: 1, maxWidth: 480, height: 38, borderRadius: 20, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: 100, height: 34, borderRadius: 20, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: 80, height: 34, borderRadius: 20, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: 90, height: 34, borderRadius: 20, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', marginLeft: 'auto', flexShrink: 0 }} />
      </div>

      <div className="feed-skeleton-wrap">
        {/* Mobile header skeleton */}
        <div className="feed-skeleton-header">
          <div style={{ width: 140, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        </div>
        {/* Mobile search skeleton */}
        <div className="feed-skeleton-search" />
        {/* Cards */}
        <div className="feed-skeleton-cols">
          {[0, 1].map(col => (
            <div key={col} className="feed-skeleton-col">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton-shimmer" style={{
                  aspectRatio: ['3/4', '1/1', '4/5'][i],
                  borderRadius: 14,
                  background: 'rgba(0,0,0,0.06)',
                }} />
              ))}
            </div>
          ))}
          {/* Extra column shown only on desktop */}
          <div className="feed-skeleton-col-extra">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                aspectRatio: ['1/1', '3/4', '4/5'][i],
                borderRadius: 14,
                background: 'rgba(0,0,0,0.06)',
              }} />
            ))}
          </div>
          <div className="feed-skeleton-col-extra">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                aspectRatio: ['4/5', '3/4', '1/1'][i],
                borderRadius: 14,
                background: 'rgba(0,0,0,0.06)',
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
