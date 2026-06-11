# VerifyMyClient Developer Kit

Everything you need to build identity verification into your practice — as an
accountant, ACSP, law firm or software vendor — using the
**VerifyMyClient Partner API**.

Companies House now requires every UK director and PSC to verify their
identity. VerifyMyClient lets your firm offer that verification under your own
brand: you create an invite, your client verifies on their phone in minutes
(UK/EU driving licence or biometric passport), and you track everything to the
point of Companies House registration.

## What's in this kit

| Directory | What it is |
|---|---|
| [`openapi/`](openapi/) | The Partner API v1 specification (OpenAPI 3.1) |
| [`demo-site/`](demo-site/) | **ABC ACSP** — a complete, polished demo site and the reference integration: token-holding proxy + React landing page with live verification flow. Run it locally in two terminals. |
| [`mcp-server-v2/`](mcp-server-v2/) | MCP server — create and track verifications from Claude or any MCP-capable AI assistant |

## The API in 30 seconds

```sh
curl -X POST https://test.verifymyclient.com/api/v1/invites \
  -H "Authorization: Bearer $VMC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "client": { "name": "Jane Smith" },
    "verification_type": "idv",
    "document_method": "passport_nfc",
    "reference": "YOUR-CRM-REF-001"
  }'
```

You get back an `invite_url` — send it to your client however you like. Poll
`GET /invites/{id}` or register a webhook, and pull the report when it
completes. Credits are deducted per verification from your bundle and refunded
if you cancel an unused invite. See the
[demo site README](demo-site/README.md) for the full quickstart and the
[OpenAPI spec](openapi/) for every field.

## Environments

| | Base URL | Tokens |
|---|---|---|
| **Test** | `https://test.verifymyclient.com/api/v1` | `vmc_test_…` |
| **Production** | `https://verifymyclient.com/api/v1` | `vmc_live_…` |

Tokens are issued in the VerifyMyClient console (**Settings → API**) and shown
once. Keep them server-side — never in browser code (the demo site shows the
proxy pattern for exactly this).

## Become a partner

Partner accounts are pay-as-you-go: buy a credit bundle, consume it through
the API or the console, top up when you need to. Hosted white-label landing
pages and on-page payment collection (Stripe Connect) are on the roadmap.

→ [verifymyclient.com](https://verifymyclient.com)

## About this repository

This repo is published from VerifyMyClient's main codebase by a sync script —
issues and PRs are welcome and will be folded back upstream. No secrets live
here: the demo's `.env` is excluded by design and the kit is scanned for
tokens before every publish.

Licensed under the [MIT License](LICENSE).
