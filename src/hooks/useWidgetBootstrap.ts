import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { initFirebase } from '../lib/firebase'
import { loadThemeWithCache, applyTheme } from '../lib/theme'
import {
  onHostMessage,
  sendToHost,
  setAllowedOrigin,
  sendAck,
  isValidTenantId,
} from '../lib/postMessage'
import { fetchContacts, fetchGroups } from '../lib/hostApi'
import { fetchNoCodeData } from '../lib/firestoreData'
import { useWidgetStore } from '../lib/store'

const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT ?? 'demo'
const DEFAULT_INSTALL = import.meta.env.VITE_DEFAULT_INSTALL ?? 'default'

export function useWidgetBootstrap() {
  const [searchParams] = useSearchParams()
  const unsubRef = useRef<(() => void) | null>(null)
  const {
    setTenantInstall,
    setToken,
    setHostApiBase,
    setSelection,
    setContacts,
    setGroups,
    setHostAckReceived,
    setNoCode,
  } = useWidgetStore()

  useEffect(() => {
    initFirebase()
  }, [])

  useEffect(() => {
    const tenant = searchParams.get('tenant') ?? DEFAULT_TENANT
    const install = searchParams.get('install') ?? DEFAULT_INSTALL
    const tokenParam = searchParams.get('token')
    const hostApiParam = searchParams.get('hostApi') ?? import.meta.env.VITE_HOST_API_DEFAULT ?? ''
    const noCodeParam = searchParams.get('noCode') === 'true' || searchParams.get('noCode') === '1'
    const apiKeyParam = searchParams.get('apiKey') ?? null

    if (!isValidTenantId(tenant) || !isValidTenantId(install)) {
      console.warn('[SMS Widget] Invalid tenant/install, using defaults')
    }
    const safeTenant = isValidTenantId(tenant) ? tenant : DEFAULT_TENANT
    const safeInstall = isValidTenantId(install) ? install : DEFAULT_INSTALL

    setTenantInstall(safeTenant, safeInstall)
    setNoCode(noCodeParam)
    if (tokenParam) setToken(tokenParam)
    if (hostApiParam) setHostApiBase(hostApiParam)

    // NoCode: load contacts/groups from our Firestore (via Cloud Function)
    if (noCodeParam) {
      fetchNoCodeData(safeTenant, apiKeyParam).then(({ contacts, groups }) => {
        useWidgetStore.getState().setContacts(contacts)
        useWidgetStore.getState().setGroups(groups)
      })
    }
    // Code: hostApi + token from URL, fetch from host
    else if (hostApiParam && tokenParam) {
      const config = { baseUrl: hostApiParam, token: tokenParam }
      Promise.all([fetchContacts(config), fetchGroups(config)])
        .then(([contacts, groups]) => {
          useWidgetStore.getState().setContacts(contacts)
          useWidgetStore.getState().setGroups(groups)
        })
        .catch((err) => console.warn('[SMS Widget] Host API fetch failed:', err))
    }

    // Load theme: cache først (lynrask), deretter Firestore (oppdaterer ved endringer)
    const applyThemeToStore = (theme: { logoUrl?: string; groupsLabel?: string; privateLabel?: string }) => {
      applyTheme(theme)
      const store = useWidgetStore.getState()
      store.setLogoUrl(theme.logoUrl || null)
      store.setThemeLabels(theme.groupsLabel ?? 'GRUPPER', theme.privateLabel ?? 'PRIVAT')
    }
    loadThemeWithCache(safeTenant, safeInstall, applyThemeToStore)
  }, [searchParams, setTenantInstall, setToken, setHostApiBase, setNoCode])

  useEffect(() => {
    const unsub = onHostMessage((msg) => {
      switch (msg.type) {
        case 'HOST_ACK': {
          setAllowedOrigin(msg.allowedOrigin)
          if (msg.token) setToken(msg.token)
          const apiUrl = msg.configOverrides?.hostApi
          const noCodeOverride = msg.configOverrides?.noCode
          if (apiUrl) setHostApiBase(apiUrl)
          if (noCodeOverride === true) setNoCode(true)
          setHostAckReceived(true)
          // NoCode: fetch from our Firestore
          if (noCodeOverride === true) {
            const { tenantId } = useWidgetStore.getState()
            const apiKey = msg.configOverrides?.apiKey as string | undefined
            fetchNoCodeData(tenantId, apiKey).then(({ contacts, groups }) => {
              useWidgetStore.getState().setContacts(contacts)
              useWidgetStore.getState().setGroups(groups)
            })
          }
          // Code mode: fetch from host API if provided
          else if (apiUrl && msg.token) {
            const config = { baseUrl: apiUrl, token: msg.token }
            Promise.all([fetchContacts(config), fetchGroups(config)])
              .then(([contacts, groups]) => {
                useWidgetStore.getState().setContacts(contacts)
                useWidgetStore.getState().setGroups(groups)
              })
              .catch((err) => console.warn('[SMS Widget] Host API fetch failed:', err))
          }
          break
        }
        case 'SET_SELECTION': {
          setSelection(msg.groupIds, msg.contactIds)
          if (msg.requestId) sendAck(msg.requestId)
          break
        }
        case 'SET_CONTACTS':
          setContacts(msg.contacts)
          break
        case 'SET_GROUPS':
          setGroups(msg.groups)
          break
      }
    })

    unsubRef.current = unsub
    return () => {
      unsubRef.current?.()
    }
  }, [setToken, setHostApiBase, setSelection, setContacts, setGroups, setHostAckReceived, setNoCode])

  useEffect(() => {
    const { tenantId, installId, widgetReadySent } = useWidgetStore.getState()
    if (widgetReadySent) return

    sendToHost('WIDGET_READY', { tenant: tenantId, install: installId })
    useWidgetStore.setState({ widgetReadySent: true })
  }, [])

}
