import { useState } from 'react'
import { useWidgetStore } from '../lib/store'
import { ComposeBox } from './ComposeBox'
import { sendMessage } from '../lib/api'
import { sendEvent } from '../lib/postMessage'
import type { Message } from '../types'

export function ConversationPane() {
  const {
    getCurrentThread,
    getCurrentMessages,
    currentThreadId,
    tenantId,
    token: storeToken,
    addMessage,
    contacts,
  } = useWidgetStore()
  const token = storeToken ?? 'demo-token'

  const thread = getCurrentThread()
  const messages = getCurrentMessages()
  const [sending, setSending] = useState(false)

  const contactName =
    thread &&
    (contacts.find(
      (c) => c.externalUserId === thread.externalUserId || c.phone === thread.phone
    )?.name ?? thread.phone)

  const handleSend = async (body: string) => {
    if (!thread) return
    setSending(true)
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
      addMessage(thread.threadId, msg)

      sendEvent('message.sent', {
        messageId: res.messageId,
        threadId: thread.threadId,
        toPhone: thread.phone,
        externalUserId: thread.externalUserId,
        body,
        status: res.status,
      })
    } catch (err) {
      const msg: Message = {
        messageId: `msg_${Date.now()}`,
        threadId: thread.threadId,
        direction: 'outbound',
        body,
        status: 'failed',
        createdAt: new Date().toISOString(),
      }
      addMessage(thread.threadId, msg)
      sendEvent('message.status', { messageId: msg.messageId, status: 'failed' })
    } finally {
      setSending(false)
    }
  }

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
    <div className="flex flex-col flex-1 min-w-0">
      {/* Chat header */}
      <div
        className="border-b px-6 py-4"
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
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.messageId} message={m} contactName={contactName ?? ''} />
        ))}
      </div>

      <ComposeBox onSend={handleSend} disabled={sending} />
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
          {time}
        </div>
      </div>
    </div>
  )
}
