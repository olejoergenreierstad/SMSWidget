import { useWidgetStore } from '../lib/store'

/**
 * Whitelabel header: viser tenant-logo og bruker tema-farger
 */
export function TenantHeader() {
  const { logoUrl } = useWidgetStore()

  if (!logoUrl) return null

  return (
    <div
      className="flex-shrink-0 flex items-center px-4 py-2 border-b"
      style={{
        backgroundColor: 'var(--bg-2)',
        borderColor: 'var(--box-border)',
      }}
    >
      <img
        src={logoUrl}
        alt="Logo"
        className="h-8 max-w-[160px] object-contain object-left"
      />
    </div>
  )
}
