# SMS Widget

Production-ready, embeddable SMS Widget (white-label, multi-tenant) built with React + Firebase.

## Features

- **iframe-embeddable** – Embed in any host system (e.g., Dunbar)
- **postMessage protocol** – Secure handshake and messaging with host
- **Multi-tenant theming** – Colors, logo, fonts from Firestore per tenant/install
- **Auth** – JWT from host via postMessage or optional URL token
- **Contacts & groups** – Sourced from host API or pushed via postMessage
- **Events** – Widget emits events to host (postMessage) and webhook (server-to-server)
- **SMS** – Multi-provider, region-based routing (Sveve NO/EU, Twilio US/UK, stub)

## Tech Stack

- React + TypeScript (Vite)
- Firebase: Firestore, Auth, Cloud Functions (Node 20, ESM), Hosting
- Tailwind CSS with tenant theme via CSS variables

## Quick Start

### 1. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required for Firestore theme loading:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- (and other `VITE_FIREBASE_*` vars)

Optional:

- `VITE_WIDGET_ORIGIN` – Widget URL (default: http://localhost:5173)
- `VITE_DEFAULT_TENANT` / `VITE_DEFAULT_INSTALL` – Defaults when not in URL
- `VITE_HOST_API_DEFAULT` – Host API base URL
- `VITE_API_BASE` – Cloud Functions URL for send/inbound

### 3. Run locally

```bash
npm run dev
```

- **Widget**: http://localhost:5173/embed
- **Debug / Host Simulator**: http://localhost:5173/debug

### 4. Build

```bash
npm run build
```

## Deploy to Firebase

### 1. Configure Firebase

```bash
firebase login
firebase use your-project-id
```

Update `.firebaserc` with your project ID.

### 2. Deploy

```bash
npm run build
firebase deploy
```

This deploys:

- **Hosting** – React app (dist/)
- **Functions** – sendMessage, inboundMessage, eventsFlush
- **Firestore rules**

### 3. Post-deploy

- Set `VITE_API_BASE` to your Functions URL, e.g.  
  `https://europe-north1-YOUR_PROJECT.cloudfunctions.net`
- Rebuild and redeploy if you change env vars.

## Embedding the Widget

### Iframe

```html
<iframe
  src="https://your-widget-url.com/embed?tenant=acme&install=xyz"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

Optional query params:

- `tenant` – Tenant ID (required for theming)
- `install` – Install ID (optional, for install-specific theme)
- `token` – JWT (optional; prefer postMessage)
- `hostApi` – Host API base URL (optional)
- `noCode` – `true` = data from our Firestore; `false`/omit = data from host (postMessage/API)

### postMessage Protocol

#### 1. Widget → Host: WIDGET_READY

```json
{
  "source": "sms-widget",
  "version": "1.0.0",
  "type": "WIDGET_READY",
  "tenant": "acme",
  "install": "xyz"
}
```

#### 2. Host → Widget: HOST_ACK

```json
{
  "source": "host",
  "version": "1.0",
  "type": "HOST_ACK",
  "allowedOrigin": "https://your-host.com",
  "token": "eyJ...",
  "configOverrides": {
    "hostApi": "https://api.your-host.com"
  }
}
```

#### 3. Host → Widget: SET_SELECTION

```json
{
  "source": "host",
  "version": "1.0",
  "requestId": "req_123",
  "type": "SET_SELECTION",
  "groupIds": ["g1"],
  "contactIds": ["u1"]
}
```

#### 4. Host → Widget: SET_CONTACTS (push mode)

```json
{
  "source": "host",
  "version": "1.0",
  "type": "SET_CONTACTS",
  "contacts": [
    {
      "externalUserId": "u1",
      "name": "Alice",
      "phone": "+4712345678",
      "groupIds": ["g1"],
      "updatedAt": "2025-02-22T10:00:00Z"
    }
  ]
}
```

#### 5. Host → Widget: SET_GROUPS (push mode)

```json
{
  "source": "host",
  "version": "1.0",
  "type": "SET_GROUPS",
  "groups": [
    {
      "externalGroupId": "g1",
      "name": "Sales",
      "memberExternalUserIds": ["u1", "u2"],
      "updatedAt": "2025-02-22T10:00:00Z"
    }
  ]
}
```

#### 6. Widget → Host: EVENT

```json
{
  "source": "sms-widget",
  "version": "1.0.0",
  "type": "EVENT",
  "eventType": "message.sent",
  "payload": {
    "messageId": "msg_123",
    "threadId": "thread_4712345678",
    "body": "Hello",
    "status": "sent"
  }
}
```

#### 7. Widget → Host: ACK (for SET_SELECTION)

```json
{
  "source": "sms-widget",
  "version": "1.0.0",
  "type": "ACK",
  "requestId": "req_123"
}
```

## Firestore Schema

### Whitelabel / multi-tenant tema (tenantId fra Firestore)

Tema lastes fra `tenants/{tenantId}` med overstyringer fra `tenants/{tenantId}/installs/{installId}`.
Install-felter overstyrer tenant-felter.

```javascript
// tenants/acme (base whitelabel) – alle felter valgfrie, bruk default hvis ikke satt
{
  brand: "#EF5350",         // Knapper, valgt element, accent
  brand2: "#E53935",        // Hover-variant
  brandText: "#ffffff",     // Tekst på knapper/valgt
  bg: "#ffffff",
  bg2: "#f8fafc",          // Sekundær bakgrunn (header)
  widgetBg: "#f3f4f6",     // Widget-bakgrunn
  boxBg: "#ffffff",        // Bakgrunn bokser (grupper, privat, melding)
  boxBorder: "#e5e7eb",    // Ramme rundt bokser
  boxHover: "#f9fafb",     // Hover på listeelementer
  text: "#0f172a",         // Hovedtekst
  textMuted: "#64748b",    // Dempet tekst
  radius: "0.5rem",
  logoUrl: "https://acme.com/logo.png",
  fontFamily: "Inter, sans-serif",
  dotGroup: "#22c55e",     // Prikk uvalgt gruppe (grønn)
  dotContact: "#3b82f6",   // Prikk uvalgt kontakt (blå)
  groupsLabel: "GRUPPER", // Overskrift gruppe-seksjon
  privateLabel: "PRIVAT"   // Overskrift privat-seksjon
}

// tenants/acme/installs/xyz (install-spesifikke overstyringer)
{
  brand: "#059669",
  groupsLabel: "EVENTER",
  logoUrl: "https://acme.com/install-xyz-logo.png"
}
```

Logo vises i header når `logoUrl` er satt.

### SMS provider config (per tenant)

```javascript
// Enkel: én provider for alle
{ smsProvider: "sveve" }   // eller "twilio", "twilio_us", "twilio_uk", "stub"

// Region-basert routing (f.eks. USA → Twilio, Norge → Sveve)
{
  smsProviders: {
    default: "sveve",      // Norge/Europa
    "+1": "twilio_us",     // USA
    "+44": "twilio_uk",    // UK
    "+47": "sveve"
  }
}

// Valgfri avsendernavn/-nummer (overstyrer env default)
{ smsFrom: "+4712345678" }  // eller bedriftsnavn for Sveve
```

Uten config brukes `stub` (simulerer sending).

### Collections

- `tenants/{tenantId}` – Tenant config + theme
- `tenants/{tenantId}/installs/{installId}` – Install overrides
- `tenants/{tenantId}/threads/{threadId}` – Threads
- `tenants/{tenantId}/threads/{threadId}/messages/{messageId}` – Messages
- `tenants/{tenantId}/eventsOutbox/{eventId}` – Events for webhook delivery

## Host API (optional)

If host provides `hostApi` (via HOST_ACK or query param), widget fetches:

- `GET /widget/contacts` – Returns `Contact[]`
- `GET /widget/groups` – Returns `Group[]`
- `GET /widget/group-members?groupId=` – Returns `string[]` (member IDs)

Auth: `Authorization: Bearer <token>`

## NoCode vs Code mode

| Mode | Contacts/Groups source |
|------|-------------------------|
| **noCode=true** | Our Firestore (`tenants/{id}/contacts`, `tenants/{id}/groups`) via Cloud Function `getTenantData` |
| **noCode=false** | Host (postMessage SET_CONTACTS/SET_GROUPS or Host API) |

For NoCode, seed Firestore with contacts and groups. See `scripts/seed-noCode-demo.js` for structure.

### Sikkerhet (tenant + apiKey)

- **apiKey**: Når en tenant opprettes med `setupTenant`, genereres en `apiKey`. Den brukes for `getTenantData` – uten riktig apiKey kan ingen hente contacts/groups for den tenanten.
- **setupTenant**: Beskyttes med `SETUP_ADMIN_SECRET` (Firebase env). Sett via `firebase functions:config:set setup.admin_secret "hemmelig"` eller tilsvarende.
- **Code mode**: Host sender data – kun host som har tilgang til widgeten kan sende. `allowedOrigin` i HOST_ACK begrenser hvem som kan sende meldinger.

## Cloud Functions

- **GET /getTenantData?tenantId=** – NoCode: returns `{ contacts, groups }` from Firestore
- **POST /sendMessage** – Send SMS via tenant-configured provider. Body: `{ tenantId, threadId?, toPhone, body, externalUserId?, groupExternalId? }`
- **POST /inboundMessage** – Simulated inbound webhook. Body: `{ tenantId, fromPhone, body }`
- **POST /setupTenant** – Opprett tenant. Body: `{ tenantId?, name?, noCode?, smsProvider?, smsProviders?, smsFrom? }`
- **POST /eventsFlush** – Flush eventsOutbox to `hostWebhookUrl`. Body: `{ tenantId, installId? }`

All require `Authorization: Bearer <token>` (TODO: proper JWT validation).

### SMS providers (Cloud Functions env)

Sett via `firebase functions:config:set` eller `.env` i functions-mappen:

| Provider | Env vars |
|----------|----------|
| **Sveve** (NO/EU) | `SMS_SVEVE_USER`, `SMS_SVEVE_PASSWD`, `SMS_SVEVE_FROM` (valgfri) |
| **Twilio** (global) | `SMS_TWILIO_ACCOUNT_SID`, `SMS_TWILIO_AUTH_TOKEN`, `SMS_TWILIO_FROM` |
| **Twilio US** | `SMS_TWILIO_US_ACCOUNT_SID`, `SMS_TWILIO_US_AUTH_TOKEN`, `SMS_TWILIO_US_FROM` |
| **Twilio UK** | `SMS_TWILIO_UK_ACCOUNT_SID`, `SMS_TWILIO_UK_AUTH_TOKEN`, `SMS_TWILIO_UK_FROM` |
| **stub** | Ingen – simulerer sending |

## Debug Page

Visit `/debug` for:

- Host simulator – embeds iframe, sends HOST_ACK, SET_CONTACTS, SET_GROUPS, SET_SELECTION
- Message log – incoming/outgoing postMessages
- Store state – current tenant, handshake status, contacts/groups count

## License

MIT
