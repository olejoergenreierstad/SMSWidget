/**
 * Twilio SMS provider – US, UK, global.
 * Env per region:
 *   twilio:     SMS_TWILIO_ACCOUNT_SID, SMS_TWILIO_AUTH_TOKEN, SMS_TWILIO_FROM
 *   twilio_us:  SMS_TWILIO_US_ACCOUNT_SID, SMS_TWILIO_US_AUTH_TOKEN, SMS_TWILIO_US_FROM
 *   twilio_uk:  SMS_TWILIO_UK_ACCOUNT_SID, SMS_TWILIO_UK_AUTH_TOKEN, SMS_TWILIO_UK_FROM
 */

function getTwilioConfig(providerKey) {
  const suffix = providerKey === 'twilio' ? '' : `_${providerKey.replace('twilio_', '').toUpperCase()}`
  const accountSid = process.env[`SMS_TWILIO${suffix}_ACCOUNT_SID`] || process.env.SMS_TWILIO_ACCOUNT_SID
  const authToken = process.env[`SMS_TWILIO${suffix}_AUTH_TOKEN`] || process.env.SMS_TWILIO_AUTH_TOKEN
  const from = process.env[`SMS_TWILIO${suffix}_FROM`] || process.env.SMS_TWILIO_FROM
  return { accountSid, authToken, from }
}

export async function send({ toPhone, body, fromNumber }, providerKey = 'twilio') {
  const { accountSid, authToken, from } = getTwilioConfig(providerKey)

  if (!accountSid || !authToken) {
    throw new Error(`Twilio SMS not configured: SMS_TWILIO_ACCOUNT_SID and SMS_TWILIO_AUTH_TOKEN required`)
  }

  const fromNum = fromNumber || from
  if (!fromNum) {
    throw new Error('Twilio SMS requires from number: SMS_TWILIO_FROM or smsFrom in tenant config')
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      To: toPhone,
      From: fromNum,
      Body: body,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`Twilio SMS failed: ${data.message || res.statusText}`)
  }

  return {
    externalId: data.sid || `twilio_${Date.now()}`,
    status: data.status === 'queued' || data.status === 'sent' ? 'sent' : data.status,
  }
}
