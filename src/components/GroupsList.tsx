import { useWidgetStore } from '../lib/store'
import type { Group } from '../types'

export function GroupsList() {
  const { groups, selectedGroupIds, setSelection, setActiveTab, setCurrentThread, groupsLabel } =
    useWidgetStore()

  const filtered = groups

  const toggleGroup = (id: string) => {
    const next = selectedGroupIds.includes(id) ? [] : [id]
    setSelection(next, [])
    setCurrentThread(null)
    if (next.length > 0) setActiveTab('broadcast')
  }

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
        {groupsLabel}
      </h3>
      <ul className="space-y-1 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Ingen grupper
          </li>
        ) : (
          filtered.map((g) => (
            <GroupItem
              key={g.externalGroupId}
              group={g}
              selected={selectedGroupIds.includes(g.externalGroupId)}
              onToggle={() => toggleGroup(g.externalGroupId)}
            />
          ))
        )}
      </ul>
    </div>
  )
}

function GroupItem({
  group,
  selected,
  onToggle,
}: {
  group: Group
  selected: boolean
  onToggle: () => void
}) {
  const count = group.memberExternalUserIds.length

  return (
    <li
      onClick={onToggle}
      data-theme-hover
      data-selected={selected ? '' : undefined}
      className="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
      style={{
        backgroundColor: selected ? 'var(--brand)' : 'transparent',
        color: selected ? 'var(--brand-text)' : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: selected ? 'var(--brand-text)' : 'var(--dot-group)',
          }}
        />
        <span className="text-sm font-medium">{group.name}</span>
      </div>
      <div
        className="text-xs ml-4"
        style={{ color: selected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)' }}
      >
        {count} deltagere
      </div>
    </li>
  )
}
