/**
 * API for tenant setup (setupTenant) and fetching tenant data from host
 */

import { getApiBase } from './apiBase'

export interface SetupTenantParams {
  tenantId?: string
  name?: string
  noCode?: boolean
  seedDemo?: boolean
  preserveApiKey?: boolean
  smsProvider?: string
  smsProviders?: Record<string, string>
  smsFrom?: string
  brand?: string
  groupsLabel?: string
  privateLabel?: string
  logoUrl?: string
  [key: string]: unknown
}

export interface SetupTenantResponse {
  tenantId: string
  name: string
  noCode: boolean
  apiKey: string
  smsProvider?: string
  smsProviders?: Record<string, string>
  smsFrom?: string
  contactsCount: number
  groupsCount: number
}

export async function setupTenant(
  adminSecret?: string,
  params?: SetupTenantParams
): Promise<SetupTenantResponse> {
  const base = getApiBase()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (adminSecret) {
    headers.Authorization = `Bearer ${adminSecret}`
  }
  const res = await fetch(`${base}/setupTenant`, {
    method: 'POST',
    headers,
    body: params ? JSON.stringify(params) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Setup failed: ${res.status}`)
  }
  return res.json()
}
