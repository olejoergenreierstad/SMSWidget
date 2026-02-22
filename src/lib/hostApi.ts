/**
 * Host API client - fetches contacts/groups from host backend
 * Used when host provides API base URL via HOST_ACK or query param
 */

import type { Contact, Group } from '../types'

export interface HostApiConfig {
  baseUrl: string
  token: string
}

export async function fetchContacts(config: HostApiConfig): Promise<Contact[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/widget/contacts`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  })
  if (!res.ok) throw new Error(`Host API: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.contacts ?? []
}

export async function fetchGroups(config: HostApiConfig): Promise<Group[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/widget/groups`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  })
  if (!res.ok) throw new Error(`Host API: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.groups ?? []
}

export async function fetchGroupMembers(
  config: HostApiConfig,
  groupId: string
): Promise<string[]> {
  const res = await fetch(
    `${config.baseUrl.replace(/\/$/, '')}/widget/group-members?groupId=${encodeURIComponent(groupId)}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    }
  )
  if (!res.ok) throw new Error(`Host API: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.memberExternalUserIds ?? []
}
