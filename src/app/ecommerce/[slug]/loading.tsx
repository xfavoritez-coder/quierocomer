export default function Loading() {
  return (
    <div className="min-h-screen" style={{ background: "#f5f3ee" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .sk {
          background: linear-gradient(90deg, #e8e5df 25%, #f0ede7 50%, #e8e5df 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
          border-radius: 6px;
        }
        .sk-light {
          background: linear-gradient(90deg, #f0ede8 25%, #f7f5f0 50%, #f0ede8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
          border-radius: 6px;
        }
        .sk-white {
          background: linear-gradient(90deg, #ffffff 25%, #f7f5f0 50%, #ffffff 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
      `}} />

      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4" style={{ background: "#e0ddd5" }}>
        <div className="w-9 h-9 rounded-lg sk" style={{ opacity: 0.4 }} />
        <div className="w-24 h-10 rounded-lg sk" style={{ opacity: 0.4 }} />
        <div className="flex gap-0.5">
          <div className="w-9 h-9 rounded-lg sk" style={{ opacity: 0.4 }} />
          <div className="w-9 h-9 rounded-lg sk" style={{ opacity: 0.4 }} />
        </div>
      </div>

      {/* Address bar */}
      <div className="px-4 pt-3 pb-2.5" style={{ background: "#f0ede7" }}>
        <div className="w-full h-10 rounded-full sk-white" />
      </div>

      {/* Category nav */}
      <div className="px-4 py-3 flex gap-7" style={{ background: "#f5f3ee" }}>
        <div className="w-14 h-3.5 sk-light rounded" />
        <div className="w-20 h-3.5 sk-light rounded" />
        <div className="w-12 h-3.5 sk-light rounded" />
        <div className="w-24 h-3.5 sk-light rounded" />
        <div className="w-16 h-3.5 sk-light rounded" />
      </div>
      <div className="h-px" style={{ background: "rgba(0,0,0,0.04)" }} />

      {/* Products */}
      <div className="max-w-6xl mx-auto px-4 pt-5">
        {/* Category title */}
        <div className="w-28 h-3.5 sk-light rounded mb-4" />

        {/* Product cards */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-lg overflow-hidden flex shadow-sm" style={{ opacity: 1 - (i - 1) * 0.12 }}>
              <div className="w-36 sm:w-40 aspect-square shrink-0 sk-white" />
              <div className="flex-1 p-3 flex flex-col justify-center">
                <div className="w-3/4 h-4 sk-light rounded mb-2" />
                <div className="w-full h-3 sk-light rounded mb-1.5" style={{ opacity: 0.6 }} />
                <div className="w-2/3 h-3 sk-light rounded mb-3" style={{ opacity: 0.4 }} />
                <div className="flex items-center justify-between">
                  <div className="w-16 h-4 sk-light rounded" />
                  <div className="w-9 h-9 rounded-full sk-light" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
