// Data contracts for SMS Widget

export interface Contact {
  externalUserId: string
  name: string
  phone: string
  email?: string
  groupIds: string[]
  updatedAt: string
}

export interface Group {
  externalGroupId: string
  name: string
  memberExternalUserIds: string[]
  updatedAt: string
  startDate?: string
  endDate?: string
}

export interface Thread {
  threadId: string
  externalUserId?: string
  phone: string
  lastMessageAt: string
}

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed'
export type MessageDirection = 'outbound' | 'inbound'

export interface Message {
  messageId: string
  threadId: string
  direction: MessageDirection
  body: string
  status: MessageStatus
  createdAt: string
}

export type EventType =
  | 'message.sent'
  | 'message.status'
  | 'message.inbound'
  | 'thread.updated'

export interface EventPayload {
  type: EventType
  payload: Record<string, unknown>
}

// PostMessage protocol types
export const WIDGET_VERSION = '1.0.0'
export const WIDGET_SOURCE = 'sms-widget'

export interface BaseMessage {
  source: string
  version: string
  requestId?: string
}

export interface WidgetReadyMessage extends BaseMessage {
  type: 'WIDGET_READY'
  tenant: string
  install: string
}

export interface HostAckMessage extends BaseMessage {
  type: 'HOST_ACK'
  allowedOrigin: string
  token?: string
  configOverrides?: {
    hostApi?: string
    [key: string]: unknown
  }
}

export interface SetSelectionMessage extends BaseMessage {
  type: 'SET_SELECTION'
  groupIds?: string[]
  contactIds?: string[]
}

export interface SetContactsMessage extends BaseMessage {
  type: 'SET_CONTACTS'
  contacts: Contact[]
}

export interface SetGroupsMessage extends BaseMessage {
  type: 'SET_GROUPS'
  groups: Group[]
}

export interface EventMessage extends BaseMessage {
  type: 'EVENT'
  eventType: EventType
  payload: Record<string, unknown>
}

export interface AckMessage extends BaseMessage {
  type: 'ACK'
  requestId: string
}

export type HostToWidgetMessage =
  | HostAckMessage
  | SetSelectionMessage
  | SetContactsMessage
  | SetGroupsMessage

export type WidgetToHostMessage =
  | WidgetReadyMessage
  | EventMessage
  | AckMessage
