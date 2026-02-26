import { onRequest } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'
import { getProviderForPhone, sendSms } from './sms-providers/index.js'

initializeApp()
const db = getFirestore()

const REGION = 'europe-north1'

/**
 * Validate tenantId/installId format
 */
function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 1 && id.length <= 64
}

/**
 * Flush eventsOutbox til hostWebhookUrl (for noCode – host oppdaterer sin database)
 */
async function flushEventsToHost(tenantId, installId) {
  const tenantRef = db.collection('tenants').doc(tenantId)
  const installRef = installId ? tenantRef.collection('installs').doc(installId) : null
  const installSnap = installRef ? await installRef.get() : null
  const tenantSnap = await tenantRef.get()
  const config = installSnap?.exists
    ? installSnap.data()
    : tenantSnap.exists
      ? tenantSnap.data()
      : {}
  const webhookUrl = config.hostWebhookUrl
  if (!webhookUrl) return

  const eventsRef = tenantRef.collection('eventsOutbox')
  const snapshot = await eventsRef.where('delivered', '==', false).limit(50).get()
  for (const doc of snapshot.docs) {
    const event = doc.data()
    const idempotencyKey = `${tenantId}_${doc.id}`
    try {
      const fetchRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ type: event.type, payload: event.payload, tenantId }),
      })
      if (fetchRes.ok) await doc.ref.update({ delivered: true })
    } catch (err) {
      console.error('flushEventsToHost: webhook delivery failed', err)
    }
  }
}

/**
 * Auth middleware - require Bearer token or shared secret
 * TODO: Implement proper JWT validation or shared secret check
 */
function requireAuth(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = auth.slice(7)
  // TODO: Validate JWT or shared secret
  return token
}

/**
 * POST /api/sendMessage
 * Body: { tenantId, threadId?, toPhone, body, externalUserId?, groupExternalId? }
 * Uses tenant smsProvider/smsProviders config for region-based routing.
 */
export const sendMessage = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: ['SMS_TWILIO_ACCOUNT_SID', 'SMS_TWILIO_AUTH_TOKEN', 'SMS_TWILIO_FROM'],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      requireAuth(req)
      const { tenantId, threadId, toPhone, body, externalUserId, groupExternalId } = req.body || {}
      if (!tenantId || !toPhone || !body) {
        res.status(400).json({ error: 'Missing tenantId, toPhone, or body' })
        return
      }
      if (!isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const tenantSnap = await tenantRef.get()
      const tenantData = tenantSnap.exists ? tenantSnap.data() : {}

      const providerKey = getProviderForPhone(tenantData, toPhone)
      const fromNumber = tenantData.smsFrom || null

      const threadsRef = db.collection('tenants').doc(tenantId).collection('threads')
      const tid = threadId || `thread_${toPhone.replace(/\D/g, '')}`
      const threadRef = threadsRef.doc(tid)
      const threadSnap = await threadRef.get()

      if (!threadSnap.exists) {
        await threadRef.set({
          threadId: tid,
          phone: toPhone,
          externalUserId: externalUserId || null,
          lastMessageAt: new Date().toISOString(),
        })
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const messagesRef = threadRef.collection('messages')
      await messagesRef.doc(messageId).set({
        messageId,
        threadId: tid,
        direction: 'outbound',
        body,
        status: 'queued',
        createdAt: new Date().toISOString(),
        groupExternalId: groupExternalId || null,
      })

      let sendResult
      try {
        sendResult = await sendSms(providerKey, { toPhone, body, fromNumber })
      } catch (sendErr) {
        console.error('sendMessage SMS provider error:', sendErr)
        await messagesRef.doc(messageId).update({ status: 'failed', error: sendErr.message })
        res.status(502).json({ error: `SMS send failed: ${sendErr.message}` })
        return
      }

      const status = sendResult.status === 'sent' ? 'sent' : 'queued'
      await messagesRef.doc(messageId).update({
        status,
        externalId: sendResult.externalId,
      })

      const eventsRef = db.collection('tenants').doc(tenantId).collection('eventsOutbox')
      const sentPayload = {
        messageId,
        threadId: tid,
        body,
        status,
        externalId: sendResult.externalId,
        toPhone,
        externalUserId: externalUserId || null,
        groupExternalId: groupExternalId || null,
      }
      await eventsRef.add({
        type: 'message.sent',
        payload: sentPayload,
        createdAt: new Date().toISOString(),
        delivered: false,
      })
      await eventsRef.add({
        type: 'message.status',
        payload: { messageId, status },
        createdAt: new Date().toISOString(),
        delivered: false,
      })

      await threadRef.update({ lastMessageAt: new Date().toISOString() })

      // Flush til host webhook (noCode) så host kan oppdatere sin database
      flushEventsToHost(tenantId, null).catch((err) =>
        console.error('sendMessage: flushEventsToHost failed', err)
      )

      res.status(200).json({
        messageId,
        threadId: tid,
        status,
        externalId: sendResult.externalId,
      })
    } catch (err) {
      console.error('sendMessage error:', err)
      res.status(401).json({ error: err.message || 'Unauthorized' })
    }
  }
)

/**
 * Internal: save inbound message to Firestore (used by inboundMessage and twilioInbound)
 */
async function saveInboundMessage(tenantId, fromPhone, body) {
  const tid = `thread_${fromPhone.replace(/\D/g, '')}`
  const threadsRef = db.collection('tenants').doc(tenantId).collection('threads')
  const threadRef = threadsRef.doc(tid)
  const threadSnap = await threadRef.get()

  if (!threadSnap.exists) {
    await threadRef.set({
      threadId: tid,
      phone: fromPhone,
      lastMessageAt: new Date().toISOString(),
    })
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  await threadRef.collection('messages').doc(messageId).set({
    messageId,
    threadId: tid,
    direction: 'inbound',
    body,
    status: 'delivered',
    createdAt: new Date().toISOString(),
  })

  await threadRef.update({ lastMessageAt: new Date().toISOString() })

  const eventsRef = db.collection('tenants').doc(tenantId).collection('eventsOutbox')
  await eventsRef.add({
    type: 'message.inbound',
    payload: { messageId, threadId: tid, fromPhone, body },
    createdAt: new Date().toISOString(),
    delivered: false,
  })
  await eventsRef.add({
    type: 'thread.updated',
    payload: { threadId: tid, lastMessageAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    delivered: false,
  })

  return { messageId, threadId: tid }
}

/**
 * POST /twilioInbound – Twilio webhook for inbound SMS
 * Twilio sends application/x-www-form-urlencoded: From, To, Body
 * Finds tenant by smsFrom matching To (our number), saves message
 */
export const twilioInbound = onRequest(
  { cors: false, region: REGION },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }
    try {
      const fromPhone = req.body?.From || req.body?.from
      const toPhone = req.body?.To || req.body?.to
      const body = req.body?.Body || req.body?.body || ''

      console.log('twilioInbound: From=', fromPhone, 'To=', toPhone, 'Body=', body?.slice(0, 50))

      if (!fromPhone || !body) {
        res.status(400).send('Missing From or Body')
        return
      }

      const toDigits = String(toPhone || '').replace(/\D/g, '')
      const tenantsSnap = await db.collection('tenants').get()
      let tenantId = null
      for (const doc of tenantsSnap.docs) {
        const d = doc.data()
        const smsFrom = d.smsFrom || process.env.SMS_TWILIO_FROM
        const fromDigits = String(smsFrom || '').replace(/\D/g, '')
        if (smsFrom && fromDigits === toDigits) {
          tenantId = doc.id
          break
        }
      }
      if (!tenantId) {
        console.warn('twilioInbound: no tenant for To=', toPhone, 'toDigits=', toDigits)
        res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
        return
      }

      const result = await saveInboundMessage(tenantId, fromPhone, body)
      flushEventsToHost(tenantId, null).catch((err) =>
        console.error('twilioInbound: flushEventsToHost failed', err)
      )

      res.status(200).contentType('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    } catch (err) {
      console.error('twilioInbound error:', err)
      res.status(500).send('Error')
    }
  }
)

/**
 * POST /inboundMessage (simulated webhook / manual trigger)
 * Body: { tenantId, fromPhone, body }
 */
export const inboundMessage = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const { tenantId, fromPhone, body } = req.body || {}
      if (!tenantId || !fromPhone || !body) {
        res.status(400).json({ error: 'Missing tenantId, fromPhone, or body' })
        return
      }
      if (!isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const result = await saveInboundMessage(tenantId, fromPhone, body)
      flushEventsToHost(tenantId, null).catch((err) =>
        console.error('inboundMessage: flushEventsToHost failed', err)
      )

      res.status(200).json(result)
    } catch (err) {
      console.error('inboundMessage error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

const DUNBAR148_MOCK_CONTACTS = [
  { externalUserId: 'olejorgen', name: 'Ole Jørgen Reierstad', phone: '+4791704103', email: '', groupIds: ['g1'], updatedAt: new Date().toISOString() },
]

const DUNBAR148_MOCK_GROUPS = [
  { externalGroupId: 'g1', name: 'Type seminar Stavanger 2026', memberExternalUserIds: ['olejorgen'], updatedAt: new Date().toISOString(), startDate: '2026-03-15', endDate: '2026-03-15' },
]

function generateApiKey() {
  return 'sk_' + crypto.randomBytes(24).toString('hex')
}

/**
 * POST /setupTenant
 * Oppretter kunde i Firestore med noCode, apiKey, og valgfri SMS-provider config.
 * Body: { tenantId?, name?, smsProvider?, smsProviders?, smsFrom? }
 * Krever: Authorization: Bearer <SETUP_ADMIN_SECRET> (satt i Firebase env)
 */
export const setupTenant = onRequest(
  { cors: true, region: REGION, secrets: ['SETUP_ADMIN_SECRET'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const adminSecret = process.env.SETUP_ADMIN_SECRET
      if (adminSecret) {
        const auth = req.headers.authorization
        if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== adminSecret) {
          res.status(401).json({ error: 'Unauthorized' })
          return
        }
      }

      const body = req.body || {}
      const tenantId = body.tenantId || 'dunbar148'
      const name = body.name || 'Dunbar148'
      if (!isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const existingSnap = await tenantRef.get()
      const preserveApiKey = body.preserveApiKey === true && existingSnap.exists
      const apiKey = preserveApiKey ? (existingSnap.data()?.apiKey ?? generateApiKey()) : generateApiKey()

      const tenantData = {
        name,
        noCode: body.noCode ?? false,
        apiKey,
        updatedAt: new Date().toISOString(),
      }
      if (!existingSnap.exists) {
        tenantData.createdAt = new Date().toISOString()
      }

      if (body.smsProvider) tenantData.smsProvider = body.smsProvider
      if (body.smsProviders && typeof body.smsProviders === 'object') tenantData.smsProviders = body.smsProviders
      if (body.smsFrom) tenantData.smsFrom = body.smsFrom
      if (body.hostWebhookUrl) tenantData.hostWebhookUrl = body.hostWebhookUrl

      const themeFields = ['brand', 'brand2', 'brandText', 'bg', 'bg2', 'widgetBg', 'boxBg', 'boxBorder', 'boxHover', 'text', 'textMuted', 'radius', 'logoUrl', 'fontFamily', 'dotGroup', 'dotContact', 'groupsLabel', 'privateLabel']
      for (const key of themeFields) {
        if (body[key] !== undefined) {
          tenantData[key] = body[key]
        }
      }

      await tenantRef.set(tenantData, { merge: true })

      let contactsCount = 0
      let groupsCount = 0
      if (tenantId === 'dunbar148' || body.seedDemo) {
        const contactsRef = tenantRef.collection('contacts')
        for (const c of DUNBAR148_MOCK_CONTACTS) {
          await contactsRef.doc(c.externalUserId).set(c)
        }
        const groupsRef = tenantRef.collection('groups')
        for (const g of DUNBAR148_MOCK_GROUPS) {
          await groupsRef.doc(g.externalGroupId).set(g)
        }
        contactsCount = DUNBAR148_MOCK_CONTACTS.length
        groupsCount = DUNBAR148_MOCK_GROUPS.length
      }

      res.status(200).json({
        tenantId,
        name,
        noCode: tenantData.noCode,
        apiKey,
        smsProvider: tenantData.smsProvider,
        smsProviders: tenantData.smsProviders,
        smsFrom: tenantData.smsFrom,
        contactsCount,
        groupsCount,
      })
    } catch (err) {
      console.error('setupTenant error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * GET /getThreadMessages?tenantId=xxx&threadId=xxx&apiKey=xxx (optional)
 * Returns messages for a thread, sorted by createdAt.
 */
export const getThreadMessages = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const tenantId = req.query.tenantId
      const threadId = req.query.threadId
      const apiKey = req.query.apiKey

      if (!tenantId || !threadId || !isValidId(tenantId) || !isValidId(threadId)) {
        res.status(400).json({ error: 'Invalid tenantId or threadId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const tenantSnap = await tenantRef.get()
      const tenantData = tenantSnap.exists ? tenantSnap.data() : {}

      if (tenantData.apiKey && tenantData.apiKey !== apiKey) {
        res.status(403).json({ error: 'Invalid or missing apiKey' })
        return
      }

      const messagesSnap = await tenantRef
        .collection('threads')
        .doc(threadId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .get()

      const messages = messagesSnap.docs.map((d) => {
        const data = d.data()
        return {
          messageId: data.messageId ?? d.id,
          threadId: data.threadId ?? threadId,
          direction: data.direction ?? 'outbound',
          body: data.body ?? '',
          status: data.status ?? 'delivered',
          createdAt: data.createdAt ?? '',
          groupExternalId: data.groupExternalId ?? null,
        }
      })

      res.status(200).json({ messages })
    } catch (err) {
      console.error('getThreadMessages error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * GET /getGroupMessages?tenantId=xxx&threadIds=id1,id2,id3&apiKey=xxx (optional)
 * Returns merged messages from multiple threads, sorted by createdAt.
 * Reduces parallel requests when loading group view.
 */
export const getGroupMessages = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const tenantId = req.query.tenantId
      const threadIdsParam = req.query.threadIds
      const apiKey = req.query.apiKey

      if (!tenantId || !threadIdsParam || !isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId or threadIds' })
        return
      }

      const threadIds = String(threadIdsParam)
        .split(',')
        .map((s) => s.trim())
        .filter((id) => id && isValidId(id))
        .slice(0, 50)

      if (threadIds.length === 0) {
        res.status(200).json({ messages: [] })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const tenantSnap = await tenantRef.get()
      const tenantData = tenantSnap.exists ? tenantSnap.data() : {}

      if (tenantData.apiKey && tenantData.apiKey !== apiKey) {
        res.status(403).json({ error: 'Invalid or missing apiKey' })
        return
      }

      const allMessages = []
      for (const threadId of threadIds) {
        const snap = await tenantRef
          .collection('threads')
          .doc(threadId)
          .collection('messages')
          .orderBy('createdAt', 'asc')
          .get()
        for (const d of snap.docs) {
          const data = d.data()
          allMessages.push({
            messageId: data.messageId ?? d.id,
            threadId: data.threadId ?? threadId,
            direction: data.direction ?? 'outbound',
            body: data.body ?? '',
            status: data.status ?? 'delivered',
            createdAt: data.createdAt ?? '',
            groupExternalId: data.groupExternalId ?? null,
          })
        }
      }
      allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      res.status(200).json({ messages: allMessages })
    } catch (err) {
      console.error('getGroupMessages error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * GET /getThreads?tenantId=xxx&apiKey=xxx (optional)
 * Returns threads for tenant, sorted by lastMessageAt desc.
 */
export const getThreads = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const tenantId = req.query.tenantId
      const apiKey = req.query.apiKey

      if (!tenantId || !isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const tenantSnap = await tenantRef.get()
      const tenantData = tenantSnap.exists ? tenantSnap.data() : {}

      if (tenantData.apiKey && tenantData.apiKey !== apiKey) {
        res.status(403).json({ error: 'Invalid or missing apiKey' })
        return
      }

      const threadsSnap = await tenantRef
        .collection('threads')
        .orderBy('lastMessageAt', 'desc')
        .limit(100)
        .get()

      const threads = threadsSnap.docs.map((d) => {
        const data = d.data()
        return {
          threadId: data.threadId ?? d.id,
          phone: data.phone ?? '',
          externalUserId: data.externalUserId ?? null,
          lastMessageAt: data.lastMessageAt ?? '',
        }
      })

      res.status(200).json({ threads })
    } catch (err) {
      console.error('getThreads error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * GET /getTenantData?tenantId=xxx&apiKey=xxx (optional)
 * NoCode mode: returns contacts and groups for tenant from Firestore.
 * Hvis tenant har apiKey, må apiKey sendes for å hente data (sikkerhet).
 */
export const getTenantData = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      const tenantId = req.query.tenantId
      const apiKey = req.query.apiKey

      if (!tenantId || !isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const tenantSnap = await tenantRef.get()
      const tenantData = tenantSnap.exists ? tenantSnap.data() : {}

      if (tenantData.apiKey && tenantData.apiKey !== apiKey) {
        res.status(403).json({ error: 'Invalid or missing apiKey' })
        return
      }

      const [contactsSnap, groupsSnap] = await Promise.all([
        tenantRef.collection('contacts').get(),
        tenantRef.collection('groups').get(),
      ])

      const contacts = contactsSnap.docs.map((d) => {
        const data = d.data()
        return { externalUserId: data.externalUserId ?? d.id, ...data }
      })
      const groups = groupsSnap.docs.map((d) => {
        const data = d.data()
        return { externalGroupId: data.externalGroupId ?? d.id, ...data }
      })

      res.status(200).json({ contacts, groups })
    } catch (err) {
      console.error('getTenantData error:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * POST /api/events/flush
 * Flushes eventsOutbox to hostWebhookUrl with retries
 */
export const eventsFlush = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    try {
      requireAuth(req)
      const { tenantId, installId } = req.body || {}
      if (!tenantId || !isValidId(tenantId)) {
        res.status(400).json({ error: 'Invalid tenantId' })
        return
      }

      const tenantRef = db.collection('tenants').doc(tenantId)
      const installRef = installId
        ? tenantRef.collection('installs').doc(installId)
        : null
      const installSnap = installRef ? await installRef.get() : null
      const tenantSnap = await tenantRef.get()

      const config = installSnap?.exists
        ? installSnap.data()
        : tenantSnap.exists
          ? tenantSnap.data()
          : {}
      const webhookUrl = config.hostWebhookUrl
      if (!webhookUrl) {
        res.status(200).json({ flushed: 0, message: 'No webhook configured' })
        return
      }

      const eventsRef = tenantRef.collection('eventsOutbox')
      const snapshot = await eventsRef.where('delivered', '==', false).limit(50).get()

      let flushed = 0
      for (const doc of snapshot.docs) {
        const event = doc.data()
        const idempotencyKey = `${tenantId}_${doc.id}`
        try {
          const fetchRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
              type: event.type,
              payload: event.payload,
              tenantId,
            }),
          })
          if (fetchRes.ok) {
            await doc.ref.update({ delivered: true })
            flushed++
          }
        } catch (err) {
          console.error('Webhook delivery failed:', err)
        }
      }

      res.status(200).json({ flushed })
    } catch (err) {
      console.error('eventsFlush error:', err)
      res.status(401).json({ error: err.message || 'Unauthorized' })
    }
  }
)
