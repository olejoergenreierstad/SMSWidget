import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getAnalytics, isSupported } from 'firebase/analytics'

// SMS Widget Firebase-prosjekt (smswidget)
export const firebaseConfig = {
  apiKey: 'AIzaSyB-5_NbXxZ0kUZmNJAGoru47tji9dBPo4U',
  authDomain: 'smswidget.firebaseapp.com',
  projectId: 'smswidget',
  storageBucket: 'smswidget.firebasestorage.app',
  messagingSenderId: '37519361326',
  appId: '1:37519361326:web:d579c6e83b0b25c368e6bf',
  measurementId: 'G-5N4TFFWGE8',
}

let app: FirebaseApp | null = null
let db: ReturnType<typeof getFirestore> | null = null
let auth: ReturnType<typeof getAuth> | null = null

export function initFirebase(): FirebaseApp | null {
  if (app) return app
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
  isSupported().then((yes) => yes && getAnalytics(app!))
  return app
}

export function getDb() {
  if (!db) initFirebase()
  return db
}

export { db, auth }
