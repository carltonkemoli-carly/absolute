// Shown instantly on navigation while the page renders on the server.
export default function Loading() {
  return (
    <div style={{ animation: 'fadeUp 0.2s ease' }}>
      <div style={{ height: 30, width: 200, background: 'var(--surface2)', borderRadius: 8, marginBottom: 22 }} className="shimmer" />
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card shimmer" style={{ height: 90 }} />
        ))}
      </div>
      <div className="card shimmer" style={{ height: 280 }} />
      <style>{`
        .shimmer { position: relative; overflow: hidden; }
        .shimmer::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          transform: translateX(-100%); animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  )
}
