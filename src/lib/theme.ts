/**
 * Multi-tenant theming via CSS variables
 * Loads theme from Firestore: tenants/{tenantId}/installs/{installId}
 * Fallback: tenants/{tenantId}
 *
 * Caching: Bruker localStorage for lynrask første visning.
 * 1. Hvis cache finnes → apply umiddelbart
 * 2. Les Firestore i bakgrunnen
 * 3. Oppdater cache + UI hvis endringer
 */

import { doc, getDoc, getDocFromServer } from 'firebase/firestore'
import { getDb } from './firebase'

const CACHE_PREFIX = 'sms-widget-theme:'
const CACHE_VERSION = 2

export interface TenantTheme {
  brand?: string
  brand2?: string
  brandText?: string
  bg?: string
  bg2?: string
  widgetBg?: string
  boxBg?: string
  boxBorder?: string
  boxHover?: string
  text?: string
  textMuted?: string
  radius?: string
  logoUrl?: string
  fontFamily?: string
  dotGroup?: string
  dotContact?: string
  groupsLabel?: string
  privateLabel?: string
}

const DEFAULT_THEME: Required<TenantTheme> = {
  brand: '#EF5350',
  brand2: '#E53935',
  brandText: '#ffffff',
  bg: '#ffffff',
  bg2: '#f8fafc',
  widgetBg: '#f3f4f6',
  boxBg: '#ffffff',
  boxBorder: '#e5e7eb',
  text: '#0f172a',
  textMuted: '#64748b',
  radius: '0.5rem',
  logoUrl: '',
  fontFamily: 'system-ui, sans-serif',
  dotGroup: '#22c55e',
  dotContact: '#3b82f6',
  groupsLabel: 'GRUPPER',
  privateLabel: 'PRIVAT',
}

export function applyTheme(theme: Partial<TenantTheme>, target: HTMLElement = document.documentElement): void {
  const merged = { ...DEFAULT_THEME, ...theme }
  target.style.setProperty('--brand', merged.brand)
  target.style.setProperty('--brand-2', merged.brand2)
  target.style.setProperty('--brand-text', merged.brandText)
  target.style.setProperty('--bg', merged.bg)
  target.style.setProperty('--bg-2', merged.bg2)
  target.style.setProperty('--widget-bg', merged.widgetBg)
  target.style.setProperty('--box-bg', merged.boxBg)
  target.style.setProperty('--box-border', merged.boxBorder)
  target.style.setProperty('--box-hover', merged.boxHover)
  target.style.setProperty('--text', merged.text)
  target.style.setProperty('--text-muted', merged.textMuted)
  target.style.setProperty('--radius', merged.radius)
  target.style.setProperty('--logo-url', merged.logoUrl || '')
  target.style.setProperty('--font-family', merged.fontFamily)
  target.style.setProperty('--dot-group', merged.dotGroup)
  target.style.setProperty('--dot-contact', merged.dotContact)
}

function getCacheKey(tenantId: string, installId: string): string {
  return `${CACHE_PREFIX}${tenantId}:${installId}`
}

function getCachedTheme(tenantId: string, installId: string): TenantTheme | null {
  try {
    const key = getCacheKey(tenantId, installId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TenantTheme & { _v?: number }
    if (typeof parsed !== 'object' || parsed === null) return null
    if ((parsed._v ?? 1) < CACHE_VERSION) return null
    const { _v, ...theme } = parsed
    return theme
  } catch {
    return null
  }
}

function setCachedTheme(tenantId: string, installId: string, theme: TenantTheme): void {
  try {
    const key = getCacheKey(tenantId, installId)
    localStorage.setItem(key, JSON.stringify({ ...theme, _v: CACHE_VERSION }))
  } catch {
    /* ignore */
  }
}

function themesEqual(a: TenantTheme, b: TenantTheme): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof TenantTheme>
  for (const k of keys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/**
 * Load theme with cache: apply cached immediately, then revalidate from Firestore.
 * Widget vises lynraskt, oppdateres hvis Firestore har endringer.
 */
export async function loadThemeWithCache(
  tenantId: string,
  installId: string,
  onTheme: (theme: TenantTheme) => void
): Promise<void> {
  const cached = getCachedTheme(tenantId, installId)
  if (cached) {
    onTheme(cached)
  }

  const fresh = await loadThemeFromFirestore(tenantId, installId)
  if (!themesEqual(cached ?? {}, fresh)) {
    setCachedTheme(tenantId, installId, fresh)
    onTheme(fresh)
  }
}

export async function loadThemeFromFirestore(
  tenantId: string,
  installId: string
): Promise<TenantTheme> {
  const db = getDb()
  if (!db) {
    return DEFAULT_THEME
  }

  try {
    // 1. Load tenant-level theme – getDocFromServer for fersk data (groupsLabel etc.)
    let theme: TenantTheme = { ...DEFAULT_THEME }
    const tenantRef = doc(db, 'tenants', tenantId)
    let tenantSnap
    try {
      tenantSnap = await getDocFromServer(tenantRef)
    } catch {
      tenantSnap = await getDoc(tenantRef)
    }
    if (tenantSnap.exists()) {
      theme = { ...theme, ...extractTheme(tenantSnap.data()) }
    }

    // 2. Overlay install-specific overrides
    const installRef = doc(db, 'tenants', tenantId, 'installs', installId)
    let installSnap
    try {
      installSnap = await getDocFromServer(installRef)
    } catch {
      installSnap = await getDoc(installRef)
    }
    if (installSnap.exists()) {
      const installTheme = extractTheme(installSnap.data())
      theme = { ...theme, ...installTheme }
    }

    return theme
  } catch (err) {
    console.warn('[SMS Widget] Failed to load theme from Firestore:', err)
  }

  return DEFAULT_THEME
}

function extractTheme(data: Record<string, unknown>): TenantTheme {
  const theme: TenantTheme = {}
  if (typeof data.brand === 'string') theme.brand = data.brand
  if (typeof data.brand2 === 'string') theme.brand2 = data.brand2
  if (typeof data.brandText === 'string') theme.brandText = data.brandText
  if (typeof data.bg === 'string') theme.bg = data.bg
  if (typeof data.bg2 === 'string') theme.bg2 = data.bg2
  if (typeof data.widgetBg === 'string') theme.widgetBg = data.widgetBg
  if (typeof data.boxBg === 'string') theme.boxBg = data.boxBg
  if (typeof data.boxBorder === 'string') theme.boxBorder = data.boxBorder
  if (typeof data.boxHover === 'string') theme.boxHover = data.boxHover
  if (typeof data.text === 'string') theme.text = data.text
  if (typeof data.textMuted === 'string') theme.textMuted = data.textMuted
  if (typeof data.radius === 'string') theme.radius = data.radius
  if (typeof data.logoUrl === 'string') theme.logoUrl = data.logoUrl
  if (typeof data.fontFamily === 'string') theme.fontFamily = data.fontFamily
  if (typeof data.dotGroup === 'string') theme.dotGroup = data.dotGroup
  if (typeof data.dotContact === 'string') theme.dotContact = data.dotContact
  if (typeof data.groupsLabel === 'string') theme.groupsLabel = data.groupsLabel
  if (typeof data.privateLabel === 'string') theme.privateLabel = data.privateLabel
  return theme
}
