import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from 'react'
import { useWidgetStore } from '../lib/store'
import { sendMessage, getGroupMessages } from '../lib/api'
import { sendEvent } from '../lib/postMessage'
import type { ThreadMessage } from '../lib/api'

const POLL_INTERVAL_MS = 60_000

interface GroupReply extends ThreadMessage {
  contactName: string
  phone: string
  externalUserId?: string
}

export function BroadcastCompose() {
  const {
    selectedGroupIds,
    tenantId,
    token: storeToken,
    tenantApiKey,
    groups,
    contacts,
    threads,
    setCurrentThreadByContact,
    setCurrentThread,
    setActiveTab,
    setSelection,
  } = useWidgetStore()
  const token = storeToken ?? 'demo-token'
  const apiKey = tenantApiKey ?? undefined
  const selectedGroup = selectedGroupIds.length === 1
    ? groups.find((g) => g.externalGroupId === selectedGroupIds[0])
    : null
  const groupContacts = useMemo(() => {
    if (!selectedGroup) return []
    const memberIds = new Set(selectedGroup.memberExternalUserIds)
    return contacts.filter((c) => memberIds.has(c.externalUserId))
  }, [selectedGroup, contacts])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(0)
  const [replies, setReplies] = useState<GroupReply[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadGroupReplies = useCallback(async () => {
    if (selectedGroupIds.length === 0 || groupContacts.length === 0) {
      setReplies([])
      return
    }
    setLoadingReplies(true)
    try {
      const threadIds = groupContacts.map((c) => `thread_${c.phone.replace(/\D/g, '')}`)
      const msgs = await getGroupMessages(tenantId, threadIds, apiKey)
      const threadToContact = new Map(threadIds.map((tid, i) => [tid, groupContacts[i]]))
      const merged: GroupReply[] = []
      const outboundSeen = new Set<string>()
      for (const m of msgs) {
        const contact = threadToContact.get(m.threadId)
        if (m.direction === 'inbound' && contact) {
          merged.push({
            ...m,
            contactName: contact.name,
            phone: contact.phone,
            externalUserId: contact.externalUserId,
          })
        } else if (m.direction === 'outbound') {
          const msgGroupId = m.groupExternalId ?? null
          const viewingGroupId = selectedGroupIds[0] ?? null
          if (msgGroupId !== viewingGroupId) continue
          const dedupeKey = `${m.body}|${m.createdAt.slice(0, 16)}`
          if (!outboundSeen.has(dedupeKey)) {
            outboundSeen.add(dedupeKey)
            merged.push({
              ...m,
              contactName: 'Deg',
              phone: '',
            })
          }
        }
      }
      setReplies((prev) => {
        const optimistic = prev.filter((r) => r.messageId.startsWith('opt_'))
        for (const o of optimistic) {
          const dedupeKey = `${o.body}|${o.createdAt.slice(0, 16)}`
          if (!outboundSeen.has(dedupeKey)) {
            outboundSeen.add(dedupeKey)
            merged.push(o)
          }
        }
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return merged
      })
    } catch {
      setReplies([])
    } finally {
      setLoadingReplies(false)
    }
  }, [tenantId, selectedGroupIds, groupContacts, apiKey])

  useEffect(() => {
    loadGroupReplies()
  }, [loadGroupReplies])

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const { groupId } = (e as CustomEvent).detail ?? {}
      const viewingGroupId = selectedGroupIds[0] ?? null
      if (groupId === undefined || groupId === viewingGroupId) loadGroupReplies()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && selectedGroupIds.length > 0 && groupContacts.length > 0) {
        loadGroupReplies()
      }
    }
    window.addEventListener('sms-widget:refresh-messages', onRefresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('sms-widget:refresh-messages', onRefresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadGroupReplies, selectedGroupIds, groupContacts.length])

  useEffect(() => {
    if (selectedGroupIds.length === 0 || groupContacts.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    pollRef.current = setInterval(loadGroupReplies, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [loadGroupReplies, selectedGroupIds, groupContacts.length])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    setSent(0)

    const optId = `opt_${Date.now()}`
    const optimisticReply: GroupReply = {
      messageId: optId,
      threadId: '',
      direction: 'outbound',
      body: trimmed,
      status: 'sending',
      createdAt: new Date().toISOString(),
      groupExternalId: selectedGroupIds[0] ?? undefined,
      contactName: 'Deg',
      phone: '',
    }
    setReplies((prev) => [...prev, optimisticReply].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ))

    let count = 0
    for (const c of groupContacts) {
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
    setReplies((prev) =>
      prev.map((r) => (r.messageId === optId ? { ...r, status: 'sent' as const } : r))
    )
    setSending(false)
    setBody('')
  }

  const groupName =
    selectedGroupIds.length === 1
      ? groups.find((g) => g.externalGroupId === selectedGroupIds[0])?.name
      : selectedGroupIds.length > 1
        ? `${selectedGroupIds.length} groups`
        : 'All contacts'

  const recipientNames = groupContacts.map((c) => c.name).join(', ')

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {/* Header: grønn prikk + gruppenavn + deltagere */}
      <div
        className="flex-shrink-0 border-b px-6 py-4"
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
          {groupContacts.length} deltagere
        </p>
      </div>

      {/* Svar fra gruppemedlemmer */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {loadingReplies && replies.length === 0 && (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Laster svar...
          </div>
        )}
        {replies.length === 0 && !loadingReplies && (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Ingen meldinger i denne gruppen ennå
          </div>
        )}
        {replies.map((r) => {
          const isOut = r.direction === 'outbound'
          return (
            <div
              key={r.messageId}
              className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[70%]">
                {!isOut && (
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
                    {r.contactName}
                  </div>
                )}
                <div
                  className="rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: isOut ? 'var(--brand)' : 'var(--box-hover)',
                    color: isOut ? 'var(--brand-text)' : 'var(--text)',
                  }}
                >
                  <p className="text-sm">{r.body}</p>
                </div>
                <div
                  className={`text-xs mt-1 flex items-center gap-3 flex-wrap ${isOut ? 'justify-end' : ''}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                 
                  {r.status === 'sending' && (
                    <>
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
                        aria-hidden
                      />
                      <span>Sender...</span>
                    </>
                  )}
                  {r.status !== 'sending' &&
                    new Date(r.createdAt).toLocaleTimeString('nb-NO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  {!isOut && (r.phone || r.threadId) && (
                      <button
                        type="button"
                        onClick={() => {
                          const contact = contacts.find(
                            (c) =>
                              c.phone.replace(/\D/g, '') === r.phone?.replace(/\D/g, '') ||
                              c.externalUserId === r.externalUserId
                          )
                        if (contact) {
                          setSelection([], [])
                          setCurrentThreadByContact(contact)
                          setActiveTab('1:1')
                        } else if (r.threadId && threads.some((t) => t.threadId === r.threadId)) {
                          setSelection([], [])
                          setCurrentThread(r.threadId)
                          setActiveTab('1:1')
                        }
                        }}
                        className="hover:underline font-medium"
                        style={{ color: 'var(--brand)' }}
                      >
                          Svar privat
                      </button>
                    )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Meldingsboks nederst */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 border-t px-6 py-4"
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
            Sendt {sent}/{groupContacts.length}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !body.trim() || groupContacts.length === 0}
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
