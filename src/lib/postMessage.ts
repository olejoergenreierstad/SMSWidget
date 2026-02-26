/**
 * PostMessage protocol for Widget <-> Host communication
 * Strict origin checks, handshake, ack flow
 */

import type {
  HostToWidgetMessage,
  WidgetToHostMessage,
  Contact,
  Group,
} from '../types'
import { WIDGET_VERSION, WIDGET_SOURCE } from '../types'

let requestIdCounter = 0

export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`
}

export type HostMessageHandler = (msg: HostToWidgetMessage) => void

let allowedOrigin: string | null = null
let messageHandler: HostMessageHandler | null = null

/**
 * Validate tenant/install ID format (alphanumeric, hyphen, underscore)
 */
export function isValidTenantId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 1 && id.length <= 64
}

export function setAllowedOrigin(origin: string): void {
  allowedOrigin = origin
}

export function getAllowedOrigin(): string | null {
  return allowedOrigin
}

/**
 * Check if message origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  if (!allowedOrigin) return false
  if (allowedOrigin === '*') return true
  return origin === allowedOrigin
}

/**
 * Send message to host (parent window)
 */
export function sendToHost<T extends WidgetToHostMessage['type']>(
  type: T,
  payload: Omit<Extract<WidgetToHostMessage, { type: T }>, 'source' | 'version' | 'type'>
): void {
  const target = window.parent
  if (!target || target === window) return

  const msg = {
    source: WIDGET_SOURCE,
    version: WIDGET_VERSION,
    ...payload,
    type,
  } as WidgetToHostMessage

  target.postMessage(msg, '*') // Host will validate; we send to parent
}

/**
 * Send ACK for a request
 */
export function sendAck(requestId: string): void {
  sendToHost('ACK', { requestId })
}

/**
 * Send event to host
 */
export function sendEvent(
  eventType: 'message.sent' | 'message.status' | 'message.inbound' | 'thread.updated',
  payload: Record<string, unknown>,
  requestId?: string
): void {
  sendToHost('EVENT', { eventType, payload, requestId })
}

/**
 * Register handler for host messages
 */
export function onHostMessage(handler: HostMessageHandler): () => void {
  messageHandler = handler

  const listener = (event: MessageEvent) => {
    const { origin, data } = event

    if (!data || typeof data !== 'object' || data.source !== 'host') {
      return
    }

    const msg = data as HostToWidgetMessage

    // HOST_ACK is always accepted (establishes allowedOrigin); others require origin check
    if (msg.type !== 'HOST_ACK' && !isOriginAllowed(origin)) {
      console.warn('[SMS Widget] Rejected message from disallowed origin:', origin)
      return
    }

    if (!msg.type) return

    messageHandler?.(msg)
  }

  window.addEventListener('message', listener)
  return () => {
    window.removeEventListener('message', listener)
    messageHandler = null
  }
}

/**
 * Host messages must have source: 'host' for security
 */
export function createHostAck(
  allowedOrigin: string,
  token?: string,
  configOverrides?: { hostApi?: string; noCode?: boolean; [key: string]: unknown }
) {
  return {
    source: 'host',
    version: '1.0',
    type: 'HOST_ACK',
    allowedOrigin,
    token,
    configOverrides,
  }
}

export function createSetSelection(groupIds?: string[], contactIds?: string[]) {
  return {
    source: 'host',
    version: '1.0',
    requestId: generateRequestId(),
    type: 'SET_SELECTION',
    groupIds,
    contactIds,
  }
}

export function createSetContacts(contacts: Contact[]) {
  return {
    source: 'host',
    version: '1.0',
    type: 'SET_CONTACTS',
    contacts,
  }
}

export function createSetGroups(groups: Group[]) {
  return {
    source: 'host',
    version: '1.0',
    type: 'SET_GROUPS',
    groups,
  }
}

export function createRefreshMessages(threadId?: string, groupId?: string) {
  return {
    source: 'host',
    version: '1.0',
    type: 'REFRESH_MESSAGES',
    threadId,
    groupId,
  }
}

export function createRefreshData() {
  return {
    source: 'host',
    version: '1.0',
    type: 'REFRESH_DATA',
  }
}
