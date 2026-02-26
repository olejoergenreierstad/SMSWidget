import { create } from 'zustand'
import type { Contact, Group, Thread, Message } from '../types'

export type TabMode = 'broadcast' | '1:1'

interface WidgetState {
  // Identity
  tenantId: string
  installId: string

  // Handshake
  widgetReadySent: boolean
  hostAckReceived: boolean
  token: string | null
  hostApiBase: string | null
  tenantApiKey: string | null

  // Selection
  selectedGroupIds: string[]
  selectedContactIds: string[]

  // Data (from host or API)
  contacts: Contact[]
  groups: Group[]

  // Threads & messages
  threads: Thread[]
  messagesByThread: Record<string, Message[]>
  currentThreadId: string | null

  // UI
  activeTab: TabMode
  logoUrl: string | null
  noCode: boolean
  groupsLabel: string
  privateLabel: string
  unreadGroupIds: string[]

  // Actions
  setTenantInstall: (tenantId: string, installId: string) => void
  setWidgetReadySent: (v: boolean) => void
  setHostAckReceived: (v: boolean) => void
  setToken: (t: string | null) => void
  setHostApiBase: (url: string | null) => void
  setTenantApiKey: (key: string | null) => void
  setSelection: (groupIds?: string[], contactIds?: string[]) => void
  setContacts: (contacts: Contact[]) => void
  setGroups: (groups: Group[]) => void
  setThreads: (threads: Thread[]) => void
  setMessages: (threadId: string, messages: Message[]) => void
  addMessage: (threadId: string, message: Message) => void
  setCurrentThread: (threadId: string | null) => void
  setCurrentThreadByContact: (contact: Contact) => void
  setActiveTab: (tab: TabMode) => void
  setLogoUrl: (url: string | null) => void
  setNoCode: (v: boolean) => void
  setThemeLabels: (groupsLabel: string, privateLabel: string) => void
  markGroupUnread: (groupId: string) => void
  clearGroupUnread: (groupId: string) => void
  clearAllGroupUnread: () => void
  getFilteredContacts: () => Contact[]
  getCurrentThread: () => Thread | null
  getCurrentMessages: () => Message[]
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  tenantId: 'demo',
  installId: 'default',
  widgetReadySent: false,
  hostAckReceived: false,
  token: null,
  hostApiBase: null,
  tenantApiKey: null,
  selectedGroupIds: [],
  selectedContactIds: [],
  contacts: [],
  groups: [],
  threads: [],
  messagesByThread: {},
  currentThreadId: null,
  activeTab: '1:1',
  logoUrl: null,
  noCode: false,
  groupsLabel: 'GRUPPER',
  privateLabel: 'PRIVAT',
  unreadGroupIds: [],

  setTenantInstall: (tenantId, installId) => set({ tenantId, installId }),
  setWidgetReadySent: (v) => set({ widgetReadySent: v }),
  setHostAckReceived: (v) => set({ hostAckReceived: v }),
  setToken: (t) => set({ token: t }),
  setHostApiBase: (url) => set({ hostApiBase: url }),
  setTenantApiKey: (key) => set({ tenantApiKey: key }),
  setSelection: (groupIds, contactIds) => {
    const nextGroups = groupIds ?? get().selectedGroupIds
    const nextContacts = contactIds ?? get().selectedContactIds
    const hasGroups = nextGroups.length > 0
    const hasContacts = nextContacts.length > 0
    if (hasGroups && hasContacts) {
      set({
        selectedGroupIds: nextGroups.slice(0, 1),
        selectedContactIds: [],
      })
    } else {
      set({
        selectedGroupIds: hasGroups ? nextGroups.slice(0, 1) : [],
        selectedContactIds: hasContacts ? nextContacts : [],
      })
    }
  },
  setContacts: (contacts) => set({ contacts }),
  setGroups: (groups) => set({ groups }),
  setThreads: (threads) => set({ threads }),
  setMessages: (threadId, messages) =>
    set((s) => ({
      messagesByThread: { ...s.messagesByThread, [threadId]: messages },
    })),
  addMessage: (threadId, message) =>
    set((s) => {
      const existing = s.messagesByThread[threadId] ?? []
      return {
        messagesByThread: {
          ...s.messagesByThread,
          [threadId]: [...existing, message],
        },
      }
    }),
  setCurrentThread: (threadId) => set({ currentThreadId: threadId }),
  setCurrentThreadByContact: (contact) => {
    const threadId = `thread_${contact.phone.replace(/\D/g, '')}`
    set((s) => {
      const exists = s.threads.some((t) => t.threadId === threadId)
      const newThread: Thread = {
        threadId,
        externalUserId: contact.externalUserId,
        phone: contact.phone,
        lastMessageAt: new Date().toISOString(),
      }
      return {
        currentThreadId: threadId,
        threads: exists ? s.threads : [newThread, ...s.threads],
      }
    })
  },
  setActiveTab: (activeTab) => set({ activeTab }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setThemeLabels: (groupsLabel: string, privateLabel: string) => set({ groupsLabel, privateLabel }),
  setNoCode: (v: boolean) => set({ noCode: v }),
  markGroupUnread: (groupId: string) =>
    set((s) => {
      if (s.unreadGroupIds.includes(groupId)) return s
      return { unreadGroupIds: [...s.unreadGroupIds, groupId] }
    }),
  clearGroupUnread: (groupId: string) =>
    set((s) => ({ unreadGroupIds: s.unreadGroupIds.filter((id) => id !== groupId) })),
  clearAllGroupUnread: () => set({ unreadGroupIds: [] }),

  getFilteredContacts: () => {
    const { contacts, threads, selectedGroupIds } = get()
    if (selectedGroupIds.length === 0) return contacts
    const inGroup = contacts.filter((c) =>
      c.groupIds.some((gid) => selectedGroupIds.includes(gid))
    )
    const threadPhones = new Set(threads.map((t) => t.phone.replace(/\D/g, '')))
    const fromThreadsNotInGroup = contacts.filter(
      (c) => threadPhones.has(c.phone.replace(/\D/g, '')) && !inGroup.some((g) => g.phone === c.phone)
    )
    return [...inGroup, ...fromThreadsNotInGroup]
  },

  getCurrentThread: () => {
    const { threads, currentThreadId } = get()
    if (!currentThreadId) return null
    return threads.find((t) => t.threadId === currentThreadId) ?? null
  },

  getCurrentMessages: () => {
    const { messagesByThread, currentThreadId } = get()
    if (!currentThreadId) return []
    return messagesByThread[currentThreadId] ?? []
  },
}))
