/**
 * Sveve SMS provider – Norway/Europe.
 * API: https://api.sveve.dk/SMS/SendMessage
 * Env: SMS_SVEVE_USER, SMS_SVEVE_PASSWD, SMS_SVEVE_FROM (optional)
 */

export async function send({ toPhone, body, fromNumber }) {
  const user = process.env.SMS_SVEVE_USER
  const passwd = process.env.SMS_SVEVE_PASSWD

  if (!user || !passwd) {
    throw new Error('Sveve SMS not configured: SMS_SVEVE_USER and SMS_SVEVE_PASSWD required')
  }

  const to = toPhone.replace(/\D/g, '')
  const from = fromNumber || process.env.SMS_SVEVE_FROM || 'SMS'

  const res = await fetch('https://api.sveve.dk/SMS/SendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      user,
      passwd,
      to,
      msg: body,
      from: from.slice(0, 11),
      f: 'json',
    }),
  })

  const data = await res.json()
  const response = data.response ?? data

  if (response.fatalError) {
    throw new Error(`Sveve SMS failed: ${response.fatalError}`)
  }

  const msgOkCount = response.msgOkCount ?? 0
  const ids = response.ids ?? []

  if (msgOkCount === 0 && response.errors?.length) {
    const err = response.errors[0]
    throw new Error(`Sveve SMS failed: ${err.message || JSON.stringify(err)}`)
  }

  return {
    externalId: ids[0] ? String(ids[0]) : `sveve_${Date.now()}`,
    status: msgOkCount > 0 ? 'sent' : 'failed',
  }
}
