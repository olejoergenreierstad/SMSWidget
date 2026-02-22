/**
 * SMS provider router – selects provider by tenant config and phone number.
 * Supports: stub, sveve (NO/EU), twilio (US/UK/global)
 */

import { send as sendStub } from './stub.js'
import { send as sendSveve } from './sveve.js'
import { send as sendTwilio } from './twilio.js'

const PROVIDERS = {
  stub: sendStub,
  sveve: sendSveve,
  twilio: sendTwilio,
  twilio_us: sendTwilio,
  twilio_uk: sendTwilio,
}

/**
 * Extract country prefix from E.164 phone number (+47, +1, +44, etc.)
 */
function getPhonePrefix(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length >= 11) return '+1'
  if (digits.startsWith('47')) return '+47'
  if (digits.startsWith('44')) return '+44'
  if (digits.startsWith('46')) return '+46'
  if (digits.startsWith('45')) return '+45'
  if (digits.startsWith('49')) return '+49'
  if (digits.startsWith('33')) return '+33'
  if (digits.startsWith('39')) return '+39'
  if (digits.startsWith('34')) return '+34'
  if (digits.length >= 2) return '+' + digits.slice(0, 2)
  return null
}

/**
 * Resolve which provider to use for a given tenant and phone number.
 * @param {object} tenantData - Firestore tenant document
 * @param {string} toPhone - E.164 phone number
 * @returns {string} provider key (stub, sveve, twilio, twilio_us, twilio_uk)
 */
export function getProviderForPhone(tenantData, toPhone) {
  const providers = tenantData?.smsProviders
  const singleProvider = tenantData?.smsProvider

  if (providers && typeof providers === 'object') {
    const prefix = getPhonePrefix(toPhone)
    const regionProvider = prefix && providers[prefix]
    if (regionProvider) return regionProvider
    if (providers.default) return providers.default
  }

  if (singleProvider) return singleProvider

  return 'stub'
}

/**
 * Send SMS via the appropriate provider.
 * @param {string} providerKey - stub, sveve, twilio, twilio_us, twilio_uk
 * @param {object} params - { toPhone, body, fromNumber? }
 * @returns {Promise<{ externalId: string, status: string }>}
 */
export async function sendSms(providerKey, params) {
  const sendFn = PROVIDERS[providerKey]
  if (!sendFn) {
    throw new Error(`Unknown SMS provider: ${providerKey}`)
  }
  if (providerKey.startsWith('twilio')) {
    return sendFn(params, providerKey)
  }
  return sendFn(params)
}
