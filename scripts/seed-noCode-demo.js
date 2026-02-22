/**
 * Seed Firestore with demo contacts and groups for NoCode mode.
 * Run: node scripts/seed-noCode-demo.js
 * Requires: Firebase Admin SDK or use Firebase Console to add documents manually.
 *
 * Or run in browser console when logged into Firebase:
 * firebase firestore:import /path/to/seed.json
 *
 * Manual seed via Firebase Console:
 * 1. Go to Firestore
 * 2. Create tenants/demo/contacts/ and tenants/demo/groups/
 * 3. Add documents as below
 */

const DEMO_CONTACTS = [
  { externalUserId: 'u1', name: 'Anna Hansen', phone: '+4791234567', email: 'anna.hansen@example.no', groupIds: ['g1', 'g3', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u2', name: 'Bjørn Olsen', phone: '+4792345678', email: 'bjorn.olsen@example.no', groupIds: ['g1', 'g2', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u3', name: 'Cecilie Lund', phone: '+4793456789', email: 'cecilie.lund@example.no', groupIds: ['g1', 'g3'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u4', name: 'David Nilsen', phone: '+4794567890', email: 'david.nilsen@example.no', groupIds: ['g1', 'g4', 'g5'], updatedAt: new Date().toISOString() },
  { externalUserId: 'u5', name: 'Eva Pedersen', phone: '+4795678901', email: 'eva.pedersen@example.no', groupIds: ['g2', 'g4'], updatedAt: new Date().toISOString() },
]

const DEMO_GROUPS = [
  { externalGroupId: 'g1', name: 'Type seminar Stavanger 2026', memberExternalUserIds: ['u1', 'u2', 'u3', 'u4'], updatedAt: new Date().toISOString(), startDate: '2026-03-15', endDate: '2026-03-15' },
  { externalGroupId: 'g2', name: 'Kundemøte Oslo 2026', memberExternalUserIds: ['u2', 'u5'], updatedAt: new Date().toISOString(), startDate: '2026-04-02', endDate: '2026-04-03' },
]

console.log('Seed data for tenants/demo/contacts and tenants/demo/groups:')
console.log(JSON.stringify({ contacts: DEMO_CONTACTS, groups: DEMO_GROUPS }, null, 2))
console.log('\nAdd these via Firebase Console or use Admin SDK.')
