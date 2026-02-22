/**
 * Stub SMS provider – simulates success without sending.
 * Used when no real provider is configured or for testing.
 */

export async function send({ toPhone, body }) {
  const externalId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  return {
    externalId,
    status: 'sent',
  }
}
