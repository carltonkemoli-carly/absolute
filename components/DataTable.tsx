import type { CSSProperties, ReactNode } from 'react'

export interface Column<T> {
  /** Header on a laptop; the row label inside the card on a phone. */
  label: string
  render: (row: T) => ReactNode
  /** Money and counts read better right-aligned on a wide table. */
  align?: 'right'
  /** For values a wide table should never break mid-way, such as a date. */
  nowrap?: boolean
  /**
   * `primary` is the column that identifies the record — it becomes the card's
   * headline and drops its label. `actions` is the edit/delete column, which
   * sits at the foot of the card, also unlabelled. `select` holds a row
   * checkbox: a narrow first column on a laptop, the card's top corner on a phone.
   */
  role?: 'primary' | 'actions' | 'select'
  /** Replaces the text header on a laptop, e.g. a select-all checkbox. */
  header?: ReactNode
  /**
   * Leave this column out of the phone card. Use it when the card's headline
   * already carries the value (wrap that part in `dt-only-card`).
   */
  card?: 'hide'
}

/**
 * One table, two shapes. On a laptop it is an ordinary table; below 860px every
 * row becomes a stacked record card with each value labelled. The markup is the
 * same either way — only CSS changes — so a row is never half-visible off the
 * right edge of a phone, which is what the hand-rolled tables all did.
 *
 * No hooks, so server and client components can both use it.
 */
// Class names for callers, kept here so Tailwind's scanner sees them from a
// shared component: a class referenced only from a route-group file is dropped
// from the built CSS.
export const CARD_ONLY = 'dt-only-card'
export const ROW_SELECTED = 'row-selected'

export default function DataTable<T>({
  columns, rows, rowKey, empty, minWidth, rowClass,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Shown instead of the table when there is nothing to list. */
  empty: string
  /** Width below which the wide table scrolls sideways rather than squashing. */
  minWidth?: number
  rowClass?: (row: T) => string | undefined
}) {
  if (rows.length === 0) {
    return (
      <div className="data-table">
        <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--ink3)', fontSize: 14 }}>{empty}</div>
      </div>
    )
  }

  // Set as a custom property so the phone layout can override it from the
  // stylesheet — an inline `min-width` would win over the media query.
  const style = minWidth ? ({ '--dt-min': `${minWidth}px` } as CSSProperties) : undefined

  return (
    <div className="data-table" style={style}>
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={cellClass(c)} data-role={c.role}>{c.header ?? c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClass?.(row)}>
              {columns.map((c, i) => (
                <td key={i} className={cellClass(c)} data-label={c.label} data-role={c.role}>
                  {/* One wrapper keeps a multi-part cell as a single flex item
                      beside its label in card form. */}
                  <div className="dt-v">{c.render(row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function cellClass<T>(c: Column<T>): string | undefined {
  const names = [c.align === 'right' && 'dt-num', c.nowrap && 'dt-nowrap', c.card === 'hide' && 'dt-card-hide'].filter(Boolean)
  return names.length ? names.join(' ') : undefined
}
