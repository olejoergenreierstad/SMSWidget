import { useState } from 'react'
import { useWidgetStore } from '../lib/store'
import type { Contact } from '../types'

export function ContactsList() {
  const { getFilteredContacts, privateLabel } = useWidgetStore()
  const contacts = getFilteredContacts()
  const [search, setSearch] = useState('')

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  return (
    <div
      className="rounded-lg p-4 shadow-sm"
      style={{
        backgroundColor: 'var(--box-bg)',
        borderWidth: '1px',
        borderColor: 'var(--box-border)',
      }}
    >
      <h3
        className="text-xs font-semibold uppercase mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        {privateLabel}
      </h3>
      {contacts.length > 4 && (
        <input
          type="search"
          placeholder="Søk kontakter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none"
          style={{
            borderWidth: '1px',
            borderColor: 'var(--box-border)',
            backgroundColor: 'var(--box-bg)',
            color: 'var(--text)',
          }}
        />
      )}
      <ul className="space-y-1 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Ingen kontakter
          </li>
        ) : (
          filtered.map((c) => <ContactItem key={c.externalUserId} contact={c} />)
        )}
      </ul>
    </div>
  )
}

function ContactItem({ contact }: { contact: Contact }) {
  const { setCurrentThreadByContact, setActiveTab, setSelection, getCurrentThread } =
    useWidgetStore()
  const thread = getCurrentThread()
  const isSelected =
    thread &&
    (thread.externalUserId === contact.externalUserId || thread.phone === contact.phone)

  const handleClick = () => {
    setActiveTab('1:1')
    setSelection([], [])
    setCurrentThreadByContact(contact)
  }

  return (
    <li
      onClick={handleClick}
      data-theme-hover
      data-selected={isSelected ? '' : undefined}
      className="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
      style={{
        backgroundColor: isSelected ? 'var(--brand)' : 'transparent',
        color: isSelected ? 'var(--brand-text)' : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: isSelected ? 'var(--brand-text)' : 'var(--dot-contact)',
          }}
        />
        <span className="text-sm font-medium">{contact.name}</span>
      </div>
      <div
        className="text-xs ml-4"
        style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)' }}
      >
        Privat chat
      </div>
    </li>
  )
}
