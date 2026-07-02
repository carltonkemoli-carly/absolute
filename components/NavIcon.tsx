import type { ReactNode } from 'react'

// Monoline icon set (stroke = currentColor) for a consistent, premium nav.
const PATHS: Record<string, ReactNode> = {
  dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>),
  dispatch: (<><circle cx="12" cy="12" r="9" /><polygon points="16 8 10.5 10.5 8 16 13.5 13.5 16 8" /></>),
  flights: (<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />),
  trips: (<><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19h9a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7h9" /></>),
  fleet: (<><path d="M3 17V7c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v10" /><path d="M14 9h3.5l3.5 3.5V17" /><path d="M2 17h2M14 17h6" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  drivers: (<><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" /></>),
  clients: (<><path d="M3 21V8l6-4 6 4v13" /><path d="M15 21V11l6 3v7" /><path d="M2 21h20M7 9h.01M7 13h.01M11 9h.01M11 13h.01" /></>),
  fuel: (<><path d="M4 21V5c0-1.1.9-2 2-2h5c1.1 0 2 .9 2 2v16" /><path d="M3 21h12" /><path d="M4 11h9" /><path d="M13 8h3l2 2v7a2 2 0 0 0 4 0V9.8L18 5.5" /></>),
  servicing: (<path d="M15 5a4 4 0 0 0-5.3 5.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6A4 4 0 0 0 19 7l-2.8 2.8-2-2L17 5z" />),
  routes: (<><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  quote: (<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>),
  compliance: (<><path d="M12 21s7-3.5 7-9V5.5L12 3 5 5.5V12c0 5.5 7 9 7 9z" /><path d="m9 11.5 2 2 4-4" /></>),
  receivables: (<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.3" /><path d="M6 12h.01M18 12h.01" /></>),
  expressway: (<><path d="M12 3v18" strokeDasharray="2 3" /><path d="M5 3l-2 18M19 3l2 18" /></>),
  billing: (<><path d="M5 21V4a1 1 0 0 1 1.5-.9L8 4l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1.5.9a1 1 0 0 1 .5.9v17l-2-1.2L15 21l-1.5-1.2L12 21l-1.5-1.2L9 21l-1.5-1.2z" /><path d="M9 8h6M9 12h6" /></>),
  expenses: (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  goals: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /></>),
  reports: (<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>),
  insights: (<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>),
  payback: (<><path d="M3 17V7c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v10" /><path d="M14 9h3.5l3.5 3.5V17" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M9.5 11.5h-1.7a.8.8 0 0 0 0 1.6h1a.8.8 0 0 1 0 1.6H7M8.5 10.8v.7M8.5 14.7v.7" /></>),
  backup: (<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>),
  health: (<><path d="M3.5 12h4l2-5 3 9 2-4h5.5" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z" /></>),
}

export default function NavIcon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {PATHS[name] ?? null}
    </svg>
  )
}
