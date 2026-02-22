/**
 * NoCode mode: fetch contacts and groups from our server (Firestore via Cloud Function)
 * Hvis tenant har apiKey, må den sendes for å hente data.
 */

import type { Contact, Group } from '../types'
import { getApiBase } from './apiBase'

function buildGetTenantDataUrl(tenantId: string, apiKey?: string | null): string {
  const base = getApiBase()
  const params = new URLSearchParams({ tenantId })
  if (apiKey) params.set('apiKey', apiKey)
  return `${base}/getTenantData?${params}`
}

export async function fetchNoCodeData(
  tenantId: string,
  apiKey?: string | null
): Promise<{ contacts: Contact[]; groups: Group[] }> {
  const base = getApiBase()
  if (!base) {
    return { contacts: [], groups: [] }
  }
  const url = buildGetTenantDataUrl(tenantId, apiKey)
  const res = await fetch(url)
  if (!res.ok) {
    console.warn('[SMS Widget] NoCode: getTenantData failed', res.status)
    return { contacts: [], groups: [] }
  }
  const data = await res.json()
  return {
    contacts: Array.isArray(data.contacts) ? data.contacts : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
  }
}
