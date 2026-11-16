'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavIcon from '@/components/NavIcon'
import { quickSearch } from '@/app/(app)/search/actions'
import type { RecordSearchGroup } from '@/lib/record-search'

export type PalettePage = { href: string; label: string; group: string; icon: string; keywords?: string }

type Option = { key: string; href: string; title: string; detail?: string; badge?: string; icon?: string; section: string }

// Jump anywhere from the keyboard. Pages filter instantly; records (a passenger,
// a number plate, an invoice) are looked up on the server, scoped to what the
// signed-in role may see.
export default function CommandPalette({ pages, onClose }: { pages: PalettePage[]; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<RecordSearchGroup[]>([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const request = useRef(0)

  const term = query.trim()
  const canSearch = term.length >= 2

  // Records: debounce typing, and ignore any answer that a newer question has overtaken.
  useEffect(() => {
    const id = ++request.current
    if (!canSearch) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await quickSearch(term)
        if (id === request.current) setGroups(found)
      } catch {
        if (id === request.current) setGroups([])
      } finally {
        if (id === request.current) setSearching(false)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [term, canSearch])

  const options = useMemo<Option[]>(() => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (page: PalettePage) => {
      const text = `${page.label} ${page.group} ${page.keywords ?? ''}`.toLowerCase()
      return words.every((word) => text.includes(word))
    }
    const pageOptions = pages.filter(matches).map((page) => ({
      key: `page:${page.href}`, href: page.href, title: page.label, detail: page.group, icon: page.icon, section: words.length ? 'Pages' : 'Go to',
    }))
    const recordOptions = canSearch
      ? groups.flatMap((group) => group.items.map((item) => ({
          key: `${group.key}:${item.id}`, href: item.href, title: item.title, detail: item.summary,
          badge: item.badge?.replace(/_/g, ' '), section: group.total > group.items.length ? `${group.label} · ${group.items.length} of ${group.total}` : group.label,
        })))
      : []
    const more = canSearch && groups.some((group) => group.total > group.items.length)
      ? [{ key: 'all', href: `/search?q=${encodeURIComponent(term)}`, title: `See every result for “${term}”`, section: 'More' }]
      : []
    return [...pageOptions, ...recordOptions, ...more]
  }, [pages, groups, term, canSearch])

  const current = Math.min(active, Math.max(0, options.length - 1))

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, options.length])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  function open(option: Option | undefined) {
    if (!option) return
    onClose()
    router.push(option.href)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(current + 1, options.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(current - 1, 0)) }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1) }
    else if (event.key === 'Enter') { event.preventDefault(); open(options[current]) }
    else if (event.key === 'Escape') { event.preventDefault(); onClose() }
    else if (event.key === 'Tab') { event.preventDefault() } // keep focus in the field; arrows move through results
  }

  let lastSection = ''
  return (
    <div className="cmdk-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search and jump" onKeyDown={onKeyDown}>
        <div className="cmdk-field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            ref={inputRef} type="text" value={query} autoComplete="off" spellCheck={false}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            placeholder="Search pages, passengers, plates, invoices…"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list"
            aria-activedescendant={options[current] ? `cmdk-${current}` : undefined}
          />
          {searching && <span className="cmdk-busy" aria-hidden="true" />}
          <button type="button" className="cmdk-esc" onClick={onClose} aria-label="Close search">Esc</button>
        </div>

        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef} aria-label="Results">
          {options.map((option, index) => {
            const heading = option.section !== lastSection ? option.section : null
            lastSection = option.section
            return (
              <div key={option.key}>
                {heading && <div className="cmdk-section" role="presentation">{heading}</div>}
                <div
                  id={`cmdk-${index}`} role="option" aria-selected={index === current} data-active={index === current}
                  className="cmdk-option" onMouseMove={() => { if (index !== current) setActive(index) }} onClick={() => open(option)}
                >
                  <span className="cmdk-icon" aria-hidden="true">{option.icon ? <NavIcon name={option.icon} /> : <span className="cmdk-dot" />}</span>
                  <span className="cmdk-text"><strong>{option.title}</strong>{option.detail && <small>{option.detail}</small>}</span>
                  {option.badge && <span className="cmdk-badge">{option.badge}</span>}
                  <span className="cmdk-enter" aria-hidden="true">↵</span>
                </div>
              </div>
            )
          })}
          {options.length === 0 && (
            <p className="cmdk-empty">
              {!canSearch ? 'Type at least two characters to search records.' : searching ? 'Searching…' : `Nothing matches “${term}”. Try a shorter name, a plate, or an invoice number.`}
            </p>
          )}
        </div>

        <div className="cmdk-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="cmdk-foot-note">Trips from the last 90 days</span>
        </div>
      </div>
    </div>
  )
}
