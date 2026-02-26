/**
 * API base URL for Cloud Functions.
 * Bruker VITE_API_BASE hvis satt, ellers VITE_USE_EMULATOR → emulator, ellers prod.
 */

import { firebaseConfig } from './firebase'

const FIREBASE_PROJECT_ID = firebaseConfig.projectId
const DEFAULT_REGION = 'europe-north1'
const EMULATOR_BASE = `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/${DEFAULT_REGION}`

export function getApiBase(): string {
  const env = import.meta.env.VITE_API_BASE
  if (env !== undefined && env !== null && env !== '') {
    return String(env).replace(/\/$/, '')
  }
  if (import.meta.env.VITE_USE_EMULATOR === 'true' || import.meta.env.VITE_USE_EMULATOR === '1') {
    return EMULATOR_BASE
  }
  return `https://${DEFAULT_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`
}
