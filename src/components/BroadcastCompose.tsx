import { useState, type FormEvent } from 'react'
import { useWidgetStore } from '../lib/store'
import { sendMessage } from '../lib/api'
import { sendEvent } from '../lib/postMessage'

export function BroadcastCompose() {
  const {
    getFilteredContacts,
    selectedGroupIds,
    tenantId,
    token: storeToken,
    groups,
  } = useWidgetStore()
  const token = storeToken ?? 'demo-token'
  const contacts = getFilteredContacts()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    setSent(0)
    let count = 0
    for (const c of contacts) {
      try {
        await sendMessage({
          tenantId,
          toPhone: c.phone,
          body: trimmed,
          externalUserId: c.externalUserId,
          groupExternalId: selectedGroupIds[0],
          token,
        })
        count++
        setSent(count)
        sendEvent('message.sent', {
          toPhone: c.phone,
          externalUserId: c.externalUserId,
          groupExternalId: selectedGroupIds[0],
          body: trimmed,
        })
      } catch {
        // continue
      }
    }
    setSending(false)
    setBody('')
  }

  const groupName =
    selectedGroupIds.length === 1
      ? groups.find((g) => g.externalGroupId === selectedGroupIds[0])?.name
      : selectedGroupIds.length > 1
        ? `${selectedGroupIds.length} groups`
        : 'All contacts'

  const recipientNames = contacts.map((c) => c.name).join(', ')

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header: grønn prikk + gruppenavn + deltagere */}
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: 'var(--box-border)' }}
      >
        <h2
          className="text-lg font-semibold flex items-center gap-2"
          style={{ color: 'var(--text)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--dot-group)' }}
          />
          {groupName}
        </h2>
        <p
          className="text-sm mt-1 cursor-help"
          style={{ color: 'var(--text-muted)' }}
          title={recipientNames}
        >
          {contacts.length} deltagere
        </p>
      </div>

      {/* Midtseksjon – tom eller meldingslogg */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0" />

      {/* Meldingsboks nederst */}
      <form
        onSubmit={handleSubmit}
        className="border-t px-6 py-4"
        style={{ borderColor: 'var(--box-border)' }}
      >
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text)' }}
        >
          Melding
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv din melding her..."
          disabled={sending}
          rows={4}
          className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none mb-3"
          style={{
            borderWidth: '1px',
            borderColor: 'var(--box-border)',
            backgroundColor: 'var(--box-bg)',
            color: 'var(--text)',
          }}
        />
        {sending && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            Sendt {sent}/{contacts.length}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !body.trim() || contacts.length === 0}
          className="w-full px-4 py-3 rounded-lg font-medium disabled:cursor-not-allowed transition-colors hover:opacity-90 disabled:opacity-60"
          style={{
            backgroundColor: 'var(--brand)',
            color: 'var(--brand-text)',
          }}
        >
          {sending ? 'Sender...' : 'Send SMS'}
        </button>
      </form>
    </div>
  )
}
