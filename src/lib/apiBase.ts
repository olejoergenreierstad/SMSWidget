/**
 * API base URL for Cloud Functions.
 * Bruker VITE_API_BASE hvis satt, ellers bygges fra Firebase projectId.
 */

import { firebaseConfig } from './firebase'

const FIREBASE_PROJECT_ID = firebaseConfig.projectId
const DEFAULT_REGION = 'europe-north1'

export function getApiBase(): string {
  const env = import.meta.env.VITE_API_BASE
  if (env !== undefined && env !== null && env !== '') {
    return String(env).replace(/\/$/, '')
  }
  return `https://${DEFAULT_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`
}
