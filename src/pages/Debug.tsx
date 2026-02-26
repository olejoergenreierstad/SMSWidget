import { useEffect, useRef, useState } from 'react'
import { useWidgetStore } from '../lib/store'
import {
  createHostAck,
  createSetContacts,
  createSetGroups,
  createSetSelection,
  createRefreshMessages,
  createRefreshData,
} from '../lib/postMessage'
import { setupTenant } from '../lib/setupApi'
import { fetchNoCodeData } from '../lib/firestoreData'

// Mock data: seminar-/arrangementsgrupper med deltakere
const DEMO_GROUPS = [
  {
    externalGroupId: 'g1',
    name: 'Type seminar Stavanger 2026',
    memberExternalUserIds: ['u1', 'u2', 'u3', 'u4'],
    updatedAt: new Date().toISOString(),
    startDate: '2026-03-15',
    endDate: '2026-03-15',
  },
  {
    externalGroupId: 'g2',
    name: 'Kundemøte Oslo 2026',
    memberExternalUserIds: ['u2', 'u5', 'u6'],
    updatedAt: new Date().toISOString(),
    startDate: '2026-04-02',
    endDate: '2026-04-03',
  },
  {
    externalGroupId: 'g3',
    name: 'Onboarding Q1 2026',
    memberExternalUserIds: ['u1', 'u3', 'u7', 'u8', 'u9'],
    updatedAt: new Date().toISOString(),
    startDate: '2026-01-10',
    endDate: '2026-01-10',
  },
  {
    externalGroupId: 'g4',
    name: 'Produktlansering Bergen',
    memberExternalUserIds: ['u4', 'u5', 'u10', 'u11'],
    updatedAt: new Date().toISOString(),
    startDate: '2026-05-20',
    endDate: '2026-05-21',
  },
  {
    externalGroupId: 'g5',
    name: 'Årsmøte 2026',
    memberExternalUserIds: ['u1', 'u2', 'u4', 'u6', 'u7', 'u10'],
    updatedAt: new Date().toISOString(),
    startDate: '2026-06-02',
    endDate: '2026-06-03',
  },
]

const DEMO_CONTACTS = [
  { externalUserId: 'u1', name: 'Anna Hansen', phone: '+4791234567', email: 'anna.hansen@example.no', groupIds: ['g1', 'g3', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u2', name: 'Bjørn Olsen', phone: '+4792345678', email: 'bjorn.olsen@example.no', groupIds: ['g1', 'g2', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u3', name: 'Cecilie Lund', phone: '+4793456789', email: 'cecilie.lund@example.no', groupIds: ['g1', 'g3'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u4', name: 'David Nilsen', phone: '+4794567890', email: 'david.nilsen@example.no', groupIds: ['g1', 'g4', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u5', name: 'Eva Pedersen', phone: '+4795678901', email: 'eva.pedersen@example.no', groupIds: ['g2', 'g4'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u6', name: 'Fredrik Johansen', phone: '+4796789012', email: 'fredrik.johansen@example.no', groupIds: ['g2', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u7', name: 'Gro Kristiansen', phone: '+4797890123', email: 'gro.kristiansen@example.no', groupIds: ['g3', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u8', name: 'Henrik Eriksen', phone: '+4798901234', email: 'henrik.eriksen@example.no', groupIds: ['g3'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u9', name: 'Ingrid Andersen', phone: '+4799012345', email: 'ingrid.andersen@example.no', groupIds: ['g3'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u10', name: 'Jonas Berg', phone: '+4710123456', email: 'jonas.berg@example.no', groupIds: ['g4', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u11', name: 'Kari Solberg', phone: '+4711234567', email: 'kari.solberg@example.no', groupIds: ['g4'], updatedAt: new Date().toISOString() },
]

const CIRCLES = [
  { id: '1', name: 'Test Default...', leader: 'Leader', avatar: '🤡' },
  { id: '2', name: 'test fixed ci...', leader: 'Leader', avatar: '◆' },
  { id: '3', name: 'test auction...', leader: 'Leader', avatar: 'inb' },
]

function IconHome() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconWrench({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconMessage() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function IconRobot() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function IconChevronUp() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

export function Debug() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [messages, setMessages] = useState<Array<{ dir: string; msg: unknown }>>([])
  const [adminOpen, setAdminOpen] = useState(true)
  const [othAdminOpen, setOthAdminOpen] = useState(true)
  const [debugOpen, setDebugOpen] = useState(true)
  const [smsBadgeCount, setSmsBadgeCount] = useState(0)
  const [widgetOrigin] = useState(
    () => import.meta.env.VITE_WIDGET_ORIGIN ?? 'http://localhost:5173'
  )
  const [tenant, setTenant] = useState(() => {
    try {
      return localStorage.getItem('debug_tenant') ?? import.meta.env.VITE_DEFAULT_TENANT ?? 'demo'
    } catch {
      return import.meta.env.VITE_DEFAULT_TENANT ?? 'demo'
    }
  })
  const [install] = useState(
    () => import.meta.env.VITE_DEFAULT_INSTALL ?? 'default'
  )
  const [noCode, setNoCode] = useState(false)
  const [setupTenantId, setSetupTenantId] = useState('dunbar148')
  const [setupName, setSetupName] = useState('Dunbar148')
  const [setupSeedDemo, setSetupSeedDemo] = useState(true)
  const [setupSmsProvider, setSetupSmsProvider] = useState('')
  const [setupSmsFrom, setSetupSmsFrom] = useState('')
  const [setupHostWebhookUrl, setSetupHostWebhookUrl] = useState('')
  const [setupGroupsLabel, setSetupGroupsLabel] = useState('GRUPPER')
  const [setupPrivateLabel, setSetupPrivateLabel] = useState('PRIVAT')
  const [setupBrand, setSetupBrand] = useState('#EF5350')
  const [setupLogoUrl, setSetupLogoUrl] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [tenantApiKey, setTenantApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dunbar148_apiKey')
    } catch {
      return null
    }
  })

  const store = useWidgetStore()

  const embedUrl = `${widgetOrigin}/embed?tenant=${tenant}&install=${install}${noCode ? '&noCode=true' : ''}`

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { data } = e
      if (!data || typeof data !== 'object') return
      if (data.source === 'sms-widget') {
        setMessages((m) => [...m, { dir: 'from-widget', msg: data }])
        const maybe = data as { type?: string; eventType?: string; payload?: Record<string, unknown> }
        if (maybe.type === 'EVENT' && maybe.eventType === 'thread.updated') {
          const unread = maybe.payload?.unreadGroupsCount
          if (typeof unread === 'number') setSmsBadgeCount(unread)
        } else if (maybe.type === 'EVENT' && maybe.eventType === 'message.inbound') {
          // Fallback if widget doesn't send unread count yet
          setSmsBadgeCount((c) => c + 1)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const sendToWidget = (msg: object) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.postMessage(msg, '*')
    setMessages((m) => [...m, { dir: 'to-widget', msg }])
  }

  const handleHandshake = () => {
    sendToWidget(
      createHostAck(window.location.origin, tenantApiKey ?? 'demo-token-123', {
        hostApi: undefined,
        apiKey: tenantApiKey ?? undefined,
      })
    )
  }

  const handlePushContacts = () => {
    sendToWidget(createSetContacts(DEMO_CONTACTS))
  }

  const handlePushGroups = () => {
    sendToWidget(createSetGroups(DEMO_GROUPS))
  }

  const handleSetSelection = () => {
    sendToWidget(createSetSelection(['g1'], ['u1']))
  }

  const handleSetupDunbar148 = async () => {
    setSetupLoading(true)
    setSetupError(null)
    try {
      const adminSecret = import.meta.env.VITE_SETUP_ADMIN_SECRET ?? undefined
      const params: Record<string, unknown> = {
        tenantId: setupTenantId,
        name: setupName,
        noCode,
        seedDemo: setupSeedDemo,
        preserveApiKey: tenant === setupTenantId,
      }
      if (setupSmsProvider) params.smsProvider = setupSmsProvider
      if (setupSmsFrom) params.smsFrom = setupSmsFrom
      if (setupHostWebhookUrl) params.hostWebhookUrl = setupHostWebhookUrl
      params.groupsLabel = setupGroupsLabel
      params.privateLabel = setupPrivateLabel
      params.brand = setupBrand
      params.logoUrl = setupLogoUrl
      const res = await setupTenant(adminSecret, params)
      setTenant(setupTenantId)
      setTenantApiKey(res.apiKey)
      try {
        localStorage.setItem('dunbar148_apiKey', res.apiKey)
        localStorage.setItem('debug_tenant', setupTenantId)
      } catch {
        /* ignore */
      }
      setNoCode(false)
      setSetupError(null)
      window.location.reload()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Setup feilet')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleLoadFromServer = async () => {
    if (!tenantApiKey) return
    setSetupLoading(true)
    try {
      const { contacts, groups } = await fetchNoCodeData(tenant, tenantApiKey)
      sendToWidget(createSetContacts(contacts))
      sendToWidget(createSetGroups(groups))
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Henting feilet')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleIframeLoad = async () => {
    sendToWidget(
      createHostAck(window.location.origin, tenantApiKey ?? 'demo-token-123', {
        hostApi: undefined,
        noCode: noCode || undefined,
        apiKey: tenantApiKey ?? undefined,
      })
    )
    // Code mode: push contacts/groups from host.
    if (!noCode) {
      // NoCode: hent fra vår Firestore via getTenantData (når tenant matcher opprettet)
      if (tenantApiKey && tenant === setupTenantId) {
        try {
          const { contacts, groups } = await fetchNoCodeData(tenant, tenantApiKey)
          setTimeout(() => {
            sendToWidget(createSetContacts(contacts))
            sendToWidget(createSetGroups(groups))
          }, 300)
        } catch (err) {
          console.warn('[Debug] Kunne ikke hente Dunbar148-data:', err)
          setTimeout(() => {
            sendToWidget(createSetContacts(DEMO_CONTACTS))
            sendToWidget(createSetGroups(DEMO_GROUPS))
          }, 300)
        }
      } else {
        setTimeout(() => {
          sendToWidget(createSetContacts(DEMO_CONTACTS))
          sendToWidget(createSetGroups(DEMO_GROUPS))
        }, 300)
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top header */}
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            <span className="text-red-500 font-bold text-xl">X</span>
            <span className="text-black font-bold text-xl">X</span>
          </div>
          <span className="font-semibold text-lg">Dunbar148</span>
        </div>
        <button className="p-2 rounded hover:bg-gray-100" title="Logg ut">
          <IconExternal />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="flex-shrink-0 w-64 flex flex-col border-r border-gray-200 bg-white">
          <nav className="flex-1 py-4 overflow-y-auto">
            <a href="#" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50">
              <IconHome />
              <span>Feed</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50">
              <IconUser />
              <span>Profile</span>
            </a>

            <div className="mt-2">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="flex items-center justify-between w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <IconWrench />
                  <span>Admin Panel</span>
                </div>
                {adminOpen ? <IconChevronUp /> : <IconChevronDown />}
              </button>
              {adminOpen && (
                <div className="pl-4">
                  <button
                    onClick={() => setOthAdminOpen(!othAdminOpen)}
                    className="flex items-center justify-between w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <IconWrench className="text-red-500" />
                      <span>OTH admin</span>
                    </div>
                    {othAdminOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </button>
                  {othAdminOpen && (
                    <div className="pl-4">
                      <a
                        href="#"
                        className="flex items-center gap-3 px-4 py-2 bg-red-50 text-red-600 rounded-r"
                        onClick={(e) => {
                          e.preventDefault()
                          setSmsBadgeCount(0)
                        }}
                      >
                        <IconMessage />
                        <span>SMS</span>
                        {smsBadgeCount > 0 && (
                          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] leading-5 text-center font-semibold">
                            {smsBadgeCount > 99 ? '99+' : smsBadgeCount}
                          </span>
                        )}
                      </a>
                      <a href="#" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50">
                        <IconImage />
                        <span>Samlinger</span>
                      </a>
                      <a href="#" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50">
                        <IconUsers />
                        <span>Brukere</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <a href="#" className="flex items-center gap-3 px-4 py-2 mt-2 text-gray-700 hover:bg-gray-50">
              <IconRobot />
              <span>AI Assistant</span>
            </a>

            <div className="mt-6 px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Circles
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {CIRCLES.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                      {c.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.leader}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200 space-y-2">
            <button className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-black text-white rounded text-sm font-medium">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v17c0 .83-.67 1.5-1.5 1.5S3 21.33 3 20.5zM20 3H6c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zm-1 12H7V5h12v10z" />
              </svg>
              GET IT ON Google Play
            </button>
            <button className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-black text-white rounded text-sm font-medium">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19z" />
              </svg>
              Download on the App Store
            </button>
          </div>
        </aside>

        {/* Main content - Widget */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 flex flex-col min-h-0 p-6">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              title="SMS Widget"
              className="flex-1 w-full min-h-0 border border-gray-200 rounded-lg"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={handleIframeLoad}
            />
          </div>

          {/* Collapsible debug panel */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setDebugOpen(!debugOpen)}
              className="w-full px-4 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 flex items-center justify-between"
            >
              Host Simulator – Debug (klikk for å lukke/åpne)
              {debugOpen ? <IconChevronUp /> : <IconChevronDown />}
            </button>
            {debugOpen && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200">
                <div>
                  <div className="mb-3 p-3 bg-amber-50 rounded border border-amber-200 space-y-2">
                    <p className="text-xs font-semibold text-amber-800 uppercase">Tenant setup (lagres til Firestore)</p>
                    <p className="text-[10px] text-amber-700">
                      Krever VITE_SETUP_ADMIN_SECRET i .env.local. Fyll ut feltene og klikk «Lagre endringer».
                      Design-felter (brand, groupsLabel, etc.) lagres til Firestore. Deploy functions: firebase deploy --only functions
                    </p>
                    <label className="block text-xs">
                      Tenant ID
                      <input
                        type="text"
                        value={setupTenantId}
                        onChange={(e) => setSetupTenantId(e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      Navn
                      <input
                        type="text"
                        value={setupName}
                        onChange={(e) => setSetupName(e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={setupSeedDemo}
                        onChange={(e) => setSetupSeedDemo(e.target.checked)}
                      />
                      seedDemo
                    </label>
                    <label className="block text-xs">
                      smsProvider
                      <input
                        type="text"
                        value={setupSmsProvider}
                        onChange={(e) => setSetupSmsProvider(e.target.value)}
                        placeholder="sveve, twilio, stub"
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      smsFrom
                      <input
                        type="text"
                        value={setupSmsFrom}
                        onChange={(e) => setSetupSmsFrom(e.target.value)}
                        placeholder="+47..."
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      hostWebhookUrl (noCode – host får message.sent)
                      <input
                        type="text"
                        value={setupHostWebhookUrl}
                        onChange={(e) => setSetupHostWebhookUrl(e.target.value)}
                        placeholder="https://..."
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      groupsLabel
                      <input
                        type="text"
                        value={setupGroupsLabel}
                        onChange={(e) => setSetupGroupsLabel(e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      privateLabel
                      <input
                        type="text"
                        value={setupPrivateLabel}
                        onChange={(e) => setSetupPrivateLabel(e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      brand
                      <input
                        type="text"
                        value={setupBrand}
                        onChange={(e) => setSetupBrand(e.target.value)}
                        placeholder="#EF5350"
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      logoUrl
                      <input
                        type="text"
                        value={setupLogoUrl}
                        onChange={(e) => setSetupLogoUrl(e.target.value)}
                        placeholder="https://..."
                        className="block w-full mt-0.5 px-2 py-1 border rounded text-sm"
                      />
                    </label>
                  </div>
                  <button
                    onClick={handleSetupDunbar148}
                    disabled={setupLoading}
                    className="mb-3 px-3 py-2 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {setupLoading
                      ? 'Lagrer...'
                      : tenant === setupTenantId
                        ? `Lagre endringer (${setupName})`
                        : `Opprett ${setupName}`}
                  </button>
                  {tenant === setupTenantId && tenantApiKey && (
                    <button
                      onClick={handleLoadFromServer}
                      disabled={setupLoading}
                      className="mb-3 ml-2 px-3 py-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                      Hent mock fra server
                    </button>
                  )}
                  {setupError && (
                    <p className="text-xs text-red-600 mb-2">{setupError}</p>
                  )}
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={noCode}
                      onChange={(e) => setNoCode(e.target.checked)}
                    />
                    <span className="text-sm">NoCode (data fra vår Firestore)</span>
                  </label>
                  <label className="block text-xs mb-1">
                    Tenant ID
                    <input
                      type="text"
                      value={tenant}
                      onChange={(e) => {
                        setTenant(e.target.value)
                        try {
                          localStorage.setItem('debug_tenant', e.target.value)
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="block w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {noCode ? 'Widget henter contacts/groups fra vår server.' : 'Host sender contacts/groups via postMessage.'}
                  </p>
                  <p className="text-xs font-medium text-gray-600 mb-1">postMessage-kommandoer:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={handleHandshake}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                    >
                      HOST_ACK
                    </button>
                    <button
                      onClick={handlePushContacts}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                    >
                      SET_CONTACTS
                    </button>
                    <button
                      onClick={handlePushGroups}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                    >
                      SET_GROUPS
                    </button>
                    <button
                      onClick={handleSetSelection}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
                    >
                      SET_SELECTION
                    </button>
                    <button
                      onClick={() => sendToWidget(createRefreshMessages())}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700"
                    >
                      REFRESH_MESSAGES
                    </button>
                    <button
                      onClick={() => sendToWidget(createRefreshData())}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700"
                      title="Hent contacts/groups på nytt fra Firestore (noCode)"
                    >
                      REFRESH_DATA
                    </button>
                  </div>
                  <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32 border border-gray-200">
                    {JSON.stringify(
                      {
                        tenantId: store.tenantId,
                        installId: store.installId,
                        hostAckReceived: store.hostAckReceived,
                        contacts: store.contacts.length,
                        groups: store.groups.length,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Message log</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {messages.slice(-5).map((m, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded ${
                          m.dir === 'from-widget' ? 'bg-blue-50' : 'bg-green-50'
                        }`}
                      >
                        <span className="font-mono">{m.dir}</span>
                        <pre className="mt-1 overflow-auto text-[10px]">
                          {JSON.stringify(m.msg, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="flex-shrink-0 px-4 py-1 bg-gray-100 text-xs text-gray-500">
        localhost:5173/debug
      </div>
    </div>
  )
}

export default Debug
