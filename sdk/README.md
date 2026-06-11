# @verifymyclient/sdk

Typed, zero-dependency TypeScript client for the **VerifyMyClient Partner API v1**.
Mirrors [`openapi/vmc-partner-api.v1.yaml`](../openapi/vmc-partner-api.v1.yaml).

> Keep your API token **server-side** — never ship it to a browser. (The
> [demo site](../demo-site) shows the token-holding proxy pattern.)

## Install

```sh
npm install @verifymyclient/sdk
```

## Quickstart

```ts
import { VmcClient } from '@verifymyclient/sdk';

const vmc = new VmcClient({
  token: process.env.VMC_API_TOKEN!,            // vmc_test_… or vmc_live_…
  baseUrl: 'https://test.verifymyclient.com/api/v1', // omit for production
});

// Create an invite — Idempotency-Key is added automatically (override with opts).
const invite = await vmc.invites.create({
  client: { name: 'Jane Smith' },
  verification_type: 'idv',
  document_method: 'passport_nfc',
  reference: 'CRM-001',
});
console.log(invite.invite_url);          // send this to your client

// Poll, or use webhooks.
const fresh = await vmc.invites.get(invite.id);
console.log(fresh.status, fresh.ch_registered_at);

// Pull the report once completed.
if (fresh.status === 'completed') {
  const report = await vmc.invites.report(invite.id);
}
```

## Methods

| Call | Endpoint |
|---|---|
| `vmc.me()` / `vmc.balance()` / `vmc.verificationMethods()` | `GET /me` · `/balance` · `/verification-methods` |
| `vmc.invites.create(params, { idempotencyKey? })` | `POST /invites` |
| `vmc.invites.get(id)` / `vmc.invites.list({ status?, created_via?, limit? })` | `GET /invites/{id}` · `/invites` |
| `vmc.invites.cancel(id)` | `DELETE /invites/{id}` (credits refunded) |
| `vmc.invites.report(id)` | `GET /invites/{id}/report` |
| `vmc.webhooks.list() / create(url, events?) / delete(id)` | `… /webhooks` |

Errors throw `VmcError` (`.status`, `.type`, `.code`, `.message`).

## Verifying webhooks

```ts
import { verifyWebhookSignature } from '@verifymyclient/sdk';

// rawBody = the unparsed request body string; sig = X-VMC-Signature header.
const ok = await verifyWebhookSignature(rawBody, sig, process.env.VMC_WEBHOOK_SECRET!);
if (!ok) return res.status(400).end();
```

Licensed under the [MIT License](../LICENSE).
