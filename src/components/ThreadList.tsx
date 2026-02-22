import { useWidgetStore } from '../lib/store'

export function ThreadList() {
  const { threads, currentThreadId, setCurrentThread } = useWidgetStore()

  if (threads.length === 0) {
    return (
      <div className="p-4 text-sm text-text-muted text-center">
        Select a contact to start a conversation
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[var(--box-border)]">
      {threads.map((t) => (
        <li
          key={t.threadId}
          onClick={() => setCurrentThread(t.threadId)}
          data-theme-hover
          data-selected={currentThreadId === t.threadId ? '' : undefined}
          className="px-4 py-3 cursor-pointer border-l-4 border-transparent transition-colors"
          style={{
            borderLeftColor: currentThreadId === t.threadId ? 'var(--brand)' : undefined,
            backgroundColor: currentThreadId === t.threadId ? 'var(--box-hover)' : undefined,
          }}
        >
          <span className="font-medium block">{t.phone}</span>
          <span className="text-xs text-text-muted">
            {new Date(t.lastMessageAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  )
}
