# ABC ACSP — VerifyMyClient Partner API demo site

A fictional accountancy firm ("ABC ACSP") demonstrating client identity
verification built on the **VerifyMyClient Partner API v1** (TEST
environment). Two small npm packages: a token-holding Express proxy and a
Vite + React SPA with the designed landing page.

This site is both a live demo and the **reference implementation** for
integrating the Partner API into your own website (the "white label" model).

## Using the demo (what a visitor does)

1. Open the site and click **Verify my identity** (or pick one of the three
   method cards — driving licence and chip passport are live; passport
   without chip is agent-reviewed and coming soon).
2. Enter a first name (email is optional and not stored by the demo) and
   choose your document. **Start verification** creates a real invite on the
   TEST environment and shows:
   - a **QR code** and a **secure link** — open it on your phone to run the
     actual Folio document check, and
   - a live timeline: *Link created → Link opened → Document checked →
     Address confirmed → Verified → Registered in Companies House*.
3. The last stage is asynchronous (Companies House registration can take
   hours), so you don't need to keep the page open. Three ways to come back:
   - **Same device** — click *Track my verification*; the demo remembers
     your last verification automatically (localStorage).
   - **Tracking reference** — the status screen shows
     `Your tracking reference: inv_…` in a dashed box with a
     **Copy tracking link** button. The link looks like
     `https://<demo-host>/?track=inv_…` and opens straight into the live
     status view on any device.
   - **Manual entry** — *Track my verification* accepts the `inv_…`
     reference typed by hand.
   In the real product this would be an **emailed magic link**; the demo
   avoids sending email by design.
4. **Privacy:** don't use real client documents. Demo verifications are
   purged ~1 hour after they happen (report data, document payloads and
   personal details are scrubbed server-side); abandoned invites are purged
   after 24 hours.

## Architecture

```
┌──────────────────────┐   /demo-api/*    ┌────────────────────────┐   Authorization:    ┌──────────────────────────┐
│  Browser (SPA)       │ ───────────────▶ │  Express proxy         │   Bearer <token>    │  VerifyMyClient          │
│  web/                │   never sees     │  server/  (port 4100)  │ ──────────────────▶ │  Partner API v1 (TEST)   │
│  Vite + React + TS   │   the token      │  · holds the token     │                     │  test.verifymyclient.com │
│  + Tailwind          │ ◀─────────────── │  · per-IP rate limit   │ ◀────────────────── │  /api/v1/invites         │
│                      │  shaped JSON     │  · input validation    │                     │                          │
└──────────────────────┘                  └────────────────────────┘                     └──────────────────────────┘
        ▲
        │ dev: Vite proxies /demo-api → http://localhost:4100  (vite.config.ts server.proxy)
        │ prod: the Express server statically serves web/dist with SPA fallback (NODE_ENV=production)
```

## How to run

Prerequisites: Node >= 20.6 (for `--env-file`).

**Terminal 1 — the proxy server:**

```sh
cd server
npm install
cp .env.example .env        # then put the real VMC_DEMO_TOKEN in .env
node --env-file=.env index.js
# → ABC ACSP demo proxy listening on http://localhost:4100
```

**Terminal 2 — the web app:**

```sh
cd web
npm install
npm run dev
# → open http://localhost:5173
```

Smoke check: `curl http://localhost:4100/demo-api/health` → `{"ok":true}`.

**Production build:**

```sh
cd web && npm run build          # outputs web/dist
cd ../server && NODE_ENV=production node --env-file=.env index.js
# one process serves both the SPA and /demo-api on port 4100
```

Environment variables (server, via `.env`):

| Variable         | Required | Default                                  |
| ---------------- | -------- | ---------------------------------------- |
| `VMC_DEMO_TOKEN` | yes      | —                                        |
| `VMC_API_BASE`   | no       | `https://test.verifymyclient.com/api/v1` |
| `DEMO_PORT`      | no       | `4100`                                   |

## Using the Partner API directly (white-label integration)

Everything the demo does, your own backend can do with four calls. Get a
token from the VerifyMyClient console (**Settings → API**) — test tokens
start with `vmc_test_`. Full spec: [`../openapi/vmc-partner-api.v1.yaml`](../openapi/vmc-partner-api.v1.yaml).
There is also an MCP server for AI assistants in [`../mcp-server-v2/`](../mcp-server-v2/).

**1. Create an invite** (your system sends the link to your client):

```sh
curl -X POST https://test.verifymyclient.com/api/v1/invites \
  -H "Authorization: Bearer $VMC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "client": { "name": "Jane Smith" },
    "verification_type": "idv",
    "document_method": "passport_nfc",
    "reference": "YOUR-CRM-REF-001",
    "send_email": false
  }'
# → 201 { "id": "inv_…", "invite_url": "https://…/client-invite/…",
#         "status": "pending", "credits_charged": 2, "credits_remaining": … }
```

The `Idempotency-Key` header is **required** — retrying with the same key
returns the original response and never double-charges credits.

**2. Poll status** (or register a webhook):

```sh
curl https://test.verifymyclient.com/api/v1/invites/inv_… \
  -H "Authorization: Bearer $VMC_API_TOKEN"
# status: pending → processing → completed   (cancelled / expired / failed)
# plus identity_completed, address_completed, ch_registered_at
```

```sh
# Webhooks instead of polling. Register an endpoint — the signing secret is
# returned ONCE (events: invite.processing/completed/cancelled/expired/failed):
curl -X POST https://test.verifymyclient.com/api/v1/webhooks \
  -H "Authorization: Bearer $VMC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://your-system.example/vmc-webhook" }'
# → { "id": "wh_…", "url": "…", "events": [...], "secret": "whsec_…", "is_active": true }
```

Each delivery is an HTTP POST with this body and an `X-VMC-Signature` header:

```jsonc
// POST body
{ "id": "evt_…", "type": "invite.completed", "created": 1781200000,
  "data": { "object": { /* the full Invite, incl. status + ch_registered_at */ } } }
// Header
//   X-VMC-Signature: t=1781200000,v1=<hex>
```

Verify it before trusting the payload (Node):

```js
import crypto from 'node:crypto';
function verify(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < toleranceSec; // replay guard
  return ok && fresh;
}
```

**Retries:** a non-2xx (or no) response is retried with backoff `1m → 5m → 30m → 2h → 8h`, then the delivery is marked dead. Endpoints are idempotent on `evt_…` — dedupe on it. Up to 5 active endpoints per account.

**3. Pull the report** once completed:

```sh
curl https://test.verifymyclient.com/api/v1/invites/inv_…/report \
  -H "Authorization: Bearer $VMC_API_TOKEN"
```

**4. Cancel a pending invite** (credits are refunded):

```sh
curl -X DELETE https://test.verifymyclient.com/api/v1/invites/inv_… \
  -H "Authorization: Bearer $VMC_API_TOKEN"
```

Useful extras: `GET /me` (token introspection), `GET /balance`,
`GET /verification-methods` (types, document methods and credit costs).
Errors always look like `{ "error": { "type", "code", "message" } }`.

## Code map (what to copy for your own integration)

- `server/index.js` — the **proxy pattern**: keep your token server-side,
  shape responses, rate-limit. ~200 lines, plain Express.
- `web/src/lib/demoApi.ts` — typed client for the proxy + localStorage
  remember/recall for same-device tracking.
- `web/src/components/VerifyModal.tsx` — the 3-step flow (details → method →
  live status) with QR, copyable link, tracking reference and the async
  Companies House stage.
- `web/src/App.tsx` — the landing page (design: "ABC ACSP" by Claude),
  `?track=` deep link handling.
- `web/src/theme/tokens.ts` — brand palette (ink/ivory/brass/emerald/slate).

## Security notes

- **The Partner API token never reaches the browser.** It exists only in
  `server/.env` (gitignored) and is attached server-side as a Bearer header.
- The proxy **shapes every response**: create returns
  `{id, invite_url, status}`; status returns
  `{id, status, invite_url, identity_completed, address_completed, ch_registered_at}`
  — nothing else from upstream is forwarded.
- Invites are created with `send_email: false` and a random
  `demo-xxxxxxxx` reference, plus an `Idempotency-Key` per request.
- Per-IP **rate limit of 5 invites/hour** (in-memory; resets on restart).
- Names are sanitized (HTML stripped, 1–80 chars); invite ids must match
  `^inv_[A-Za-z0-9]+$` before being forwarded.
- A 402 from upstream is translated to a friendly
  "Demo is out of credits — contact us" message.
- Use a demo token scoped to `invites:create` + `invites:read` only.
- This is a TEST-environment demo: sample documents only, no real PII —
  and demo data is purged ~1 hour after verification anyway.
