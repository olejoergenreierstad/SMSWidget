import { useWidgetStore } from '../lib/store'
import { GroupsList } from './GroupsList'
import { ContactsList } from './ContactsList'
import { ConversationPane } from './ConversationPane'
import { BroadcastCompose } from './BroadcastCompose'
import { TenantHeader } from './TenantHeader'
import { useEffect, useRef } from 'react'
import { getGroupMessages } from '../lib/api'
import { sendEvent } from '../lib/postMessage'

export function WidgetLayout() {
  const {
    activeTab,
    selectedGroupIds,
    currentThreadId,
    tenantId,
    tenantApiKey,
    groups,
    contacts,
    unreadGroupIds,
    markGroupUnread,
  } = useWidgetStore()

  // Show broadcast when a group is selected and no 1:1 thread; otherwise show conversation
  const showBroadcast = activeTab === 'broadcast' || (selectedGroupIds.length > 0 && !currentThreadId)

  // Poll group replies for unread badges (in-memory; "seen/unseen" persistence later).
  const knownInboundByGroupRef = useRef<Map<string, Set<string>>>(new Map())
  const pollBusyRef = useRef(false)

  useEffect(() => {
    const apiKey = tenantApiKey ?? undefined
    const poll = async () => {
      if (pollBusyRef.current) return
      if (groups.length === 0 || contacts.length === 0) return
      pollBusyRef.current = true
      try {
        for (const g of groups) {
          const memberIds = new Set(g.memberExternalUserIds)
          const members = contacts.filter((c) => memberIds.has(c.externalUserId))
          if (members.length === 0) continue
          const threadIds = members.map((c) => `thread_${c.phone.replace(/\D/g, '')}`)
          const msgs = await getGroupMessages(tenantId, threadIds, apiKey)
          const inbound = msgs.filter((m) => m.direction === 'inbound')

          const known = knownInboundByGroupRef.current.get(g.externalGroupId)
          if (!known) {
            knownInboundByGroupRef.current.set(
              g.externalGroupId,
              new Set(inbound.map((m) => m.messageId))
            )
            continue
          }

          let hasNew = false
          for (const m of inbound) {
            if (!known.has(m.messageId)) {
              known.add(m.messageId)
              hasNew = true
            }
          }
          if (!hasNew) continue

          // Mark unread only if you're not currently on this group view.
          const viewingGroupId = selectedGroupIds[0] ?? null
          const isViewingThisGroup = showBroadcast && viewingGroupId === g.externalGroupId
          if (!isViewingThisGroup) {
            markGroupUnread(g.externalGroupId)
          }
        }
      } finally {
        pollBusyRef.current = false
      }
    }

    poll()
    const id = window.setInterval(poll, 20_000)
    return () => window.clearInterval(id)
  }, [tenantId, tenantApiKey, groups, contacts, selectedGroupIds, showBroadcast, markGroupUnread])

  // Sync unread group badge count to host (Debug menu badge).
  useEffect(() => {
    sendEvent('thread.updated', {
      unreadGroupsCount: unreadGroupIds.length,
      unreadGroupIds,
    })
  }, [unreadGroupIds])

  return (
    <div
      className="flex flex-col h-screen max-h-screen overflow-hidden"
      style={{
        fontFamily: 'var(--font-family)',
        backgroundColor: 'var(--widget-bg)',
      }}
    >
      <TenantHeader />

      {/* Main content: left sidebar (cards) + right chat area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden gap-4 p-4">
        {/* Left: GRUPPER + PRIVAT cards */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col min-h-0">
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <GroupsList />
            <ContactsList />
          </div>
          <button
            className="flex-shrink-0 text-sm font-medium px-2 text-left transition-colors hover:opacity-80 mt-4"
            style={{ color: 'var(--text-muted)' }}
          >
            — Arkiv
          </button>
        </div>

        {/* Right: Conversation or Broadcast */}
        <div
          className="flex-1 min-w-0 rounded-lg flex flex-col overflow-hidden shadow-sm"
          style={{
            backgroundColor: 'var(--box-bg)',
            borderWidth: '1px',
            borderColor: 'var(--box-border)',
          }}
        >
          {showBroadcast ? <BroadcastCompose /> : <ConversationPane />}
        </div>
      </div>
    </div>
  )
}
