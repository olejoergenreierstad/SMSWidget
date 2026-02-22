import { useWidgetStore } from '../lib/store'
import { GroupsList } from './GroupsList'
import { ContactsList } from './ContactsList'
import { ConversationPane } from './ConversationPane'
import { BroadcastCompose } from './BroadcastCompose'
import { TenantHeader } from './TenantHeader'

export function WidgetLayout() {
  const { activeTab, selectedGroupIds, currentThreadId } = useWidgetStore()

  // Show broadcast when a group is selected and no 1:1 thread; otherwise show conversation
  const showBroadcast = activeTab === 'broadcast' || (selectedGroupIds.length > 0 && !currentThreadId)

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
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          <GroupsList />
          <ContactsList />
          <button
            className="text-sm font-medium px-2 text-left transition-colors hover:opacity-80"
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
