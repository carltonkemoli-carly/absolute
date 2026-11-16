// The Absolute Comfort mark and wordmark, drawn inline so the lettering follows
// the theme. (As an image file its navy text disappeared on the dark sidebar.)
export default function BrandLogo({ height = 36 }: { height?: number }) {
  return (
    <svg viewBox="0 0 222 62" height={height} role="img" aria-label="Absolute Comfort Travel" style={{ display: 'block', maxWidth: '100%' }}>
      <path d="M7 46 25 12h7l18 34H39l-4-9H21l-4 9H7Zm18-17h7l-3.5-8z" style={{ fill: 'var(--brand-blue)' }} />
      <path d="M5 47c8-13 24-21 44-20" fill="none" strokeWidth="4" strokeLinecap="round" style={{ stroke: 'var(--brand-lime)' }} />
      <text x="65" y="30" fontFamily="Arial,Helvetica,sans-serif" fontWeight="700" fontSize="22" letterSpacing="1.1" style={{ fill: 'var(--ink)' }}>ABSOLUTE</text>
      <text x="66" y="49" fontFamily="Arial,Helvetica,sans-serif" fontWeight="500" fontSize="11.5" letterSpacing="2.1" style={{ fill: 'var(--accent)' }}>COMFORT TRAVEL</text>
    </svg>
  )
}
