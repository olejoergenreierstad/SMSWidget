import { getApiBase } from './apiBase'

/**
 * Widget API - send SMS via Cloud Function (stubbed)
 */

export interface SendMessageParams {
  tenantId: string
  threadId?: string
  toPhone: string
  body: string
  externalUserId?: string
  groupExternalId?: string
  token: string
}

export interface SendMessageResponse {
  messageId: string
  threadId: string
  status: 'queued' | 'sent' | 'delivered' | 'failed'
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  const API_BASE = getApiBase()
  if (!API_BASE) {
    // Stub: simulate success
    return {
      messageId: `msg_${Date.now()}`,
      threadId: params.threadId ?? `thread_${params.toPhone.replace(/\D/g, '')}`,
      status: 'sent',
    }
  }

  const base = API_BASE
  const res = await fetch(`${base}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      tenantId: params.tenantId,
      threadId: params.threadId,
      toPhone: params.toPhone,
      body: params.body,
      externalUserId: params.externalUserId,
      groupExternalId: params.groupExternalId,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Send failed: ${res.status}`)
  }

  return res.json()
}

export interface InboundMessageParams {
  tenantId: string
  fromPhone: string
  body: string
}

export async function simulateInbound(params: InboundMessageParams): Promise<void> {
  const base = getApiBase()
  if (!base) return
  await fetch(`${base}/inboundMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export interface ThreadMessage {
  messageId: string
  threadId: string
  direction: 'outbound' | 'inbound'
  body: string
  status: string
  createdAt: string
  groupExternalId?: string | null
}

export async function getThreadMessages(
  tenantId: string,
  threadId: string,
  apiKey?: string | null
): Promise<ThreadMessage[]> {
  const base = getApiBase()
  if (!base) return []
  const params = new URLSearchParams({ tenantId, threadId })
  if (apiKey) params.set('apiKey', apiKey)
  const res = await fetch(`${base}/getThreadMessages?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.messages) ? data.messages : []
}

export async function getGroupMessages(
  tenantId: string,
  threadIds: string[],
  apiKey?: string | null
): Promise<ThreadMessage[]> {
  const base = getApiBase()
  if (!base || threadIds.length === 0) return []
  const params = new URLSearchParams({ tenantId, threadIds: threadIds.join(',') })
  if (apiKey) params.set('apiKey', apiKey)
  const res = await fetch(`${base}/getGroupMessages?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.messages) ? data.messages : []
}

export interface Thread {
  threadId: string
  phone: string
  externalUserId?: string | null
  lastMessageAt: string
}


export async function getThreads(
  tenantId: string,
  apiKey?: string | null
): Promise<Thread[]> {
  const base = getApiBase()
  if (!base) return []
  const params = new URLSearchParams({ tenantId })
  if (apiKey) params.set('apiKey', apiKey)
  const res = await fetch(`${base}/getThreads?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.threads) ? data.threads : []
}
