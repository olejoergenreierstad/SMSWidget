import { useState, useEffect, useRef, useCallback } from 'react'
import { useWidgetStore } from '../lib/store'
import { ComposeBox } from './ComposeBox'
import { sendMessage, getThreadMessages } from '../lib/api'
import { sendEvent } from '../lib/postMessage'
import type { Message } from '../types'

const POLL_INTERVAL_MS = 60_000

export function ConversationPane() {
  const {
    getCurrentThread,
    getCurrentMessages,
    currentThreadId,
    tenantId,
    token: storeToken,
    tenantApiKey,
    addMessage,
    setMessages,
    messagesByThread,
    contacts,
  } = useWidgetStore()
  const token = storeToken ?? 'demo-token'
  const apiKey = tenantApiKey ?? undefined
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const thread = getCurrentThread()
  const messages = getCurrentMessages()
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const loadMessages = useCallback(async () => {
    if (!thread || !currentThreadId) return
    const tid = thread.threadId
    setLoading(true)
    try {
      const msgs = await getThreadMessages(tenantId, tid, apiKey)
      const stillViewing = useWidgetStore.getState().currentThreadId === tid
      if (!stillViewing) return
      const formatted: Message[] = msgs.map((m) => ({
        messageId: m.messageId,
        threadId: m.threadId,
        direction: m.direction,
        body: m.body,
        status: m.status as Message['status'],
        createdAt: m.createdAt,
      }))
      const existing = useWidgetStore.getState().messagesByThread[tid] ?? []
      const existingIds = new Set(existing.map((m) => m.messageId))
      const newInbound = formatted.filter(
        (m) => m.direction === 'inbound' && !existingIds.has(m.messageId)
      )
      const pending = existing.filter((m) => m.status === 'sending')
      const merged = [...formatted]
      for (const p of pending) {
        if (!merged.some((m) => m.messageId === p.messageId)) {
          merged.push(p)
        }
      }
      merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      setMessages(tid, merged)
      // Don't treat the initial load as "new messages" for the host.
      if (existing.length > 0) {
        for (const m of newInbound) {
          sendEvent('message.inbound', {
            messageId: m.messageId,
            threadId: tid,
            fromPhone: thread.phone,
            externalUserId: thread.externalUserId,
            body: m.body,
            createdAt: m.createdAt,
          })
        }
      }
    } catch {
      // Keep existing messages on error
    } finally {
      setLoading(false)
    }
  }, [tenantId, currentThreadId, thread, apiKey, setMessages])

  useEffect(() => {
    if (!thread || !currentThreadId) return
    loadMessages()
  }, [loadMessages, thread, currentThreadId])

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const { threadId } = (e as CustomEvent).detail ?? {}
      if (threadId === undefined || threadId === currentThreadId) loadMessages()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && thread && currentThreadId) loadMessages()
    }
    window.addEventListener('sms-widget:refresh-messages', onRefresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('sms-widget:refresh-messages', onRefresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadMessages, currentThreadId, thread])

  useEffect(() => {
    if (!thread || !currentThreadId) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    pollRef.current = setInterval(loadMessages, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [loadMessages, thread, currentThreadId])

  const contactName =
    thread &&
    (contacts.find(
      (c) => c.externalUserId === thread.externalUserId || c.phone === thread.phone
    )?.name ?? thread.phone)

  const handleSend = async (body: string) => {
    if (!thread) return
    setSending(true)
    const tempId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const optimisticMsg: Message = {
      messageId: tempId,
      threadId: thread.threadId,
      direction: 'outbound',
      body,
      status: 'sending',
      createdAt: new Date().toISOString(),
    }
    addMessage(thread.threadId, optimisticMsg)

    try {
      const res = await sendMessage({
        tenantId,
        threadId: thread.threadId,
        toPhone: thread.phone,
        externalUserId: thread.externalUserId,
        body,
        token,
      })

      const msg: Message = {
        messageId: res.messageId,
        threadId: thread.threadId,
        direction: 'outbound',
        body,
        status: res.status,
        createdAt: new Date().toISOString(),
      }
      const current = messagesByThread[thread.threadId] ?? []
      const updated = [...current.filter((m) => m.messageId !== tempId), msg]
      setMessages(thread.threadId, updated)

      sendEvent('message.sent', {
        messageId: res.messageId,
        threadId: thread.threadId,
        toPhone: thread.phone,
        externalUserId: thread.externalUserId,
        body,
        status: res.status,
      })
    } catch (err) {
      const current = messagesByThread[thread.threadId] ?? []
      const updated = current.map((m) =>
        m.messageId === tempId ? { ...m, status: 'failed' as const } : m
      )
      setMessages(thread.threadId, updated)
      sendEvent('message.status', { messageId: tempId, status: 'failed' })
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!currentThreadId) return
    stickToBottomRef.current = true
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, [currentThreadId, scrollToBottom])

  useEffect(() => {
    if (!currentThreadId) return
    if (!stickToBottomRef.current) return
    requestAnimationFrame(() => scrollToBottom('smooth'))
  }, [messages.length, currentThreadId, scrollToBottom])

  if (!currentThreadId) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-muted)' }}
      >
        Velg en kontakt for å starte samtalen
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {/* Chat header */}
      <div
        className="flex-shrink-0 border-b px-6 py-4"
        style={{ borderColor: 'var(--box-border)' }}
      >
        <h2
          className="text-lg font-semibold flex items-center gap-2"
          style={{ color: 'var(--text)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--dot-contact)' }}
          />
          {contactName}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Privat chat
        </p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        onScroll={() => {
          const el = scrollRef.current
          if (!el) return
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
          stickToBottomRef.current = distanceToBottom < 80
        }}
      >
        {loading && messages.length === 0 && (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Laster meldinger...
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.messageId} message={m} contactName={contactName ?? ''} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0">
        <ComposeBox onSend={handleSend} disabled={sending} />
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  contactName,
}: {
  message: Message
  contactName: string
}) {
  const isOut = message.direction === 'outbound'
  const isSending = message.status === 'sending'
  const isFailed = message.status === 'failed'
  const time = new Date(message.createdAt).toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[70%]">
        {!isOut && (
          <div
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--text)' }}
          >
            {contactName}
          </div>
        )}
        <div
          className="rounded-lg px-4 py-3"
          style={{
            backgroundColor: isOut ? 'var(--brand)' : 'var(--box-hover)',
            color: isOut ? 'var(--brand-text)' : 'var(--text)',
          }}
        >
          <p className="text-sm">{message.body}</p>
        </div>
        <div
          className={`text-xs mt-1 ${isOut ? 'text-right' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        >
          {isSending && 'Sender...'}
          {isFailed && 'Feilet'}
          {!isSending && !isFailed && time}
        </div>
      </div>
    </div>
  )
}
