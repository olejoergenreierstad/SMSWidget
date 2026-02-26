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
import { getThreads } from '../lib/api'
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
    setTenantApiKey,
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
    if (apiKeyParam) setTenantApiKey(apiKeyParam)
    if (hostApiParam) setHostApiBase(hostApiParam)

    // NoCode: load contacts/groups and threads from our Firestore (via Cloud Function)
    let threadsInterval: ReturnType<typeof setInterval> | null = null
    let noCodeCleanup: (() => void) | null = null
    if (noCodeParam) {
      const loadNoCode = () => {
        Promise.all([
          fetchNoCodeData(safeTenant, apiKeyParam),
          getThreads(safeTenant, apiKeyParam),
        ]).then(([{ contacts, groups }, threads]) => {
          const storeThreads = threads.map((t) => ({
            threadId: t.threadId,
            phone: t.phone,
            externalUserId: t.externalUserId ?? undefined,
            lastMessageAt: t.lastMessageAt,
          }))
          useWidgetStore.getState().setThreads(storeThreads)
          const byPhone = new Set(contacts.map((c) => c.phone.replace(/\D/g, '')))
          const virtualContacts = threads
            .filter((t) => !byPhone.has(t.phone.replace(/\D/g, '')))
            .map((t) => ({
              externalUserId: t.threadId,
              name: t.phone,
              phone: t.phone,
              email: '',
              groupIds: [],
              updatedAt: t.lastMessageAt,
            }))
          useWidgetStore.getState().setContacts([...contacts, ...virtualContacts])
          useWidgetStore.getState().setGroups(groups)
        })
      }
      loadNoCode()
      threadsInterval = setInterval(loadNoCode, 15000)
      const onRefreshData = () => loadNoCode()
      window.addEventListener('sms-widget:refresh-data', onRefreshData)
      noCodeCleanup = () => window.removeEventListener('sms-widget:refresh-data', onRefreshData)
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

    let onVisible: (() => void) | null = null
    if (noCodeParam) {
      onVisible = () => {
        if (document.visibilityState === 'visible') {
          Promise.all([
            fetchNoCodeData(safeTenant, apiKeyParam),
            getThreads(safeTenant, apiKeyParam),
          ]).then(([{ contacts, groups }, threads]) => {
            const storeThreads = threads.map((t) => ({
              threadId: t.threadId,
              phone: t.phone,
              externalUserId: t.externalUserId ?? undefined,
              lastMessageAt: t.lastMessageAt,
            }))
            useWidgetStore.getState().setThreads(storeThreads)
            const byPhone = new Set(contacts.map((c) => c.phone.replace(/\D/g, '')))
            const virtualContacts = threads
              .filter((t) => !byPhone.has(t.phone.replace(/\D/g, '')))
              .map((t) => ({
                externalUserId: t.threadId,
                name: t.phone,
                phone: t.phone,
                email: '',
                groupIds: [],
                updatedAt: t.lastMessageAt,
              }))
            useWidgetStore.getState().setContacts([...contacts, ...virtualContacts])
            useWidgetStore.getState().setGroups(groups)
          })
        }
      }
      document.addEventListener('visibilitychange', onVisible)
    }
    return () => {
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
      noCodeCleanup?.()
      if (threadsInterval) clearInterval(threadsInterval)
    }
  }, [searchParams, setTenantInstall, setToken, setTenantApiKey, setHostApiBase, setNoCode])

  useEffect(() => {
    const unsub = onHostMessage((msg) => {
      switch (msg.type) {
        case 'HOST_ACK': {
          setAllowedOrigin(msg.allowedOrigin)
          if (msg.token) setToken(msg.token)
          const apiKey = msg.configOverrides?.apiKey as string | undefined
          if (apiKey) setTenantApiKey(apiKey)
          const apiUrl = msg.configOverrides?.hostApi
          const noCodeOverride = msg.configOverrides?.noCode
          if (apiUrl) setHostApiBase(apiUrl)
          if (noCodeOverride === true) setNoCode(true)
          setHostAckReceived(true)
          // NoCode: fetch from our Firestore
          if (noCodeOverride === true) {
            const { tenantId } = useWidgetStore.getState()
            const apiKey = msg.configOverrides?.apiKey as string | undefined
            Promise.all([
              fetchNoCodeData(tenantId, apiKey),
              getThreads(tenantId, apiKey),
            ]).then(([{ contacts, groups }, threads]) => {
              const storeThreads = threads.map((t) => ({
                threadId: t.threadId,
                phone: t.phone,
                externalUserId: t.externalUserId ?? undefined,
                lastMessageAt: t.lastMessageAt,
              }))
              useWidgetStore.getState().setThreads(storeThreads)
              const byPhone = new Set(contacts.map((c) => c.phone.replace(/\D/g, '')))
              const virtualContacts = threads
                .filter((t) => !byPhone.has(t.phone.replace(/\D/g, '')))
                .map((t) => ({
                  externalUserId: t.threadId,
                  name: t.phone,
                  phone: t.phone,
                  email: '',
                  groupIds: [],
                  updatedAt: t.lastMessageAt,
                }))
              useWidgetStore.getState().setContacts([...contacts, ...virtualContacts])
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
        case 'REFRESH_MESSAGES': {
          window.dispatchEvent(
            new CustomEvent('sms-widget:refresh-messages', {
              detail: { threadId: msg.threadId, groupId: msg.groupId },
            })
          )
          break
        }
        case 'REFRESH_DATA': {
          window.dispatchEvent(new CustomEvent('sms-widget:refresh-data'))
          break
        }
      }
    })

    unsubRef.current = unsub
    return () => {
      unsubRef.current?.()
    }
  }, [setToken, setHostApiBase, setTenantApiKey, setSelection, setContacts, setGroups, setHostAckReceived, setNoCode])

  useEffect(() => {
    const { tenantId, installId, widgetReadySent } = useWidgetStore.getState()
    if (widgetReadySent) return

    sendToHost('WIDGET_READY', { tenant: tenantId, install: installId })
    useWidgetStore.setState({ widgetReadySent: true })
  }, [])

}

export default useWidgetBootstrap
