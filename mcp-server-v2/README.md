# @verifymyclient/mcp-server

MCP (Model Context Protocol) server for the **VerifyMyClient Partner API v1**.

It lets AI assistants — Claude Desktop, Claude Code, or any MCP-compatible client — create and manage client identity verification invites on behalf of an accounting firm or other VerifyMyClient partner:

- Create a verification invite for a client (IDV, IDV + address, or address-only) and get a secure link to share
- Check invite status and list invites
- Cancel invites (with credit refund)
- Fetch the verification report once a check completes
- Check your credit balance and available verification methods

The server talks to the VerifyMyClient Partner API over HTTPS using your partner token. It runs locally over stdio — no data is stored by the server itself.

## Requirements

- Node.js 18 or later
- A VerifyMyClient Partner API token (`vmc_test_...` or `vmc_live_...`)

## Install

Once published to npm:

```bash
npx @verifymyclient/mcp-server
```

For local development:

```bash
npm install
npm run build
npm start          # or: node dist/index.js
```

## Environment variables

| Variable        | Required | Default                              | Description                                                                 |
| --------------- | -------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `VMC_API_TOKEN` | Yes      | —                                    | Partner API token (`vmc_test_...` for sandbox, `vmc_live_...` for production) |
| `VMC_API_BASE`  | No       | `https://verifymyclient.com/api/v1`  | API base URL. Set to the test URL for sandbox use (see below)                |

The server exits with an error message on startup if `VMC_API_TOKEN` is not set.

## Claude Desktop configuration

Add this to your `claude_desktop_config.json` (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "verifymyclient": {
      "command": "npx",
      "args": ["-y", "@verifymyclient/mcp-server"],
      "env": {
        "VMC_API_TOKEN": "vmc_live_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

For a local (not yet published) build, point at the compiled file instead:

```json
{
  "mcpServers": {
    "verifymyclient": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-v2/dist/index.js"],
      "env": {
        "VMC_API_TOKEN": "vmc_test_xxxxxxxxxxxxxxxx",
        "VMC_API_BASE": "https://test.verifymyclient.com/api/v1"
      }
    }
  }
}
```

## Claude Code configuration

```bash
claude mcp add verifymyclient \
  --env VMC_API_TOKEN=vmc_live_xxxxxxxxxxxxxxxx \
  -- npx -y @verifymyclient/mcp-server
```

## Tools

| Tool                        | Description                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `create_invite`             | Create a verification invite for a client and get the invite link. Inputs: client name (required), client email, verification type (`idv` \| `idv_address` \| `address_only`, default `idv`), document method (`driving_licence` \| `passport_nfc` \| `client_choice`), reference, send email flag |
| `get_invite_status`         | Check the status of an invite (`pending`, `processing`, `completed`, `cancelled`, `expired`)        |
| `list_invites`              | List invites, with optional filters: status, reference, page, limit                                 |
| `cancel_invite`             | Cancel an invite; credits are refunded if the verification had not completed                        |
| `get_report`                | Fetch the verification report JSON for an invite (tells you if the report is not ready yet)         |
| `get_balance`               | Check remaining credits                                                                             |
| `list_verification_methods` | List available verification types with credit cost, and supported document methods                  |

Example prompts once connected:

> "Create an ID verification invite for Jane Smith (jane@example.com), reference ACME-2026, and give me the link."
>
> "How many credits do we have left?"
>
> "Has Jane Smith completed her verification yet? If so, show me the report."

## Test environment

VerifyMyClient provides a sandbox at `test.verifymyclient.com`. Use a `vmc_test_...` token and point the server at the test API:

```bash
VMC_API_TOKEN=vmc_test_xxxxxxxxxxxxxxxx \
VMC_API_BASE=https://test.verifymyclient.com/api/v1 \
npx @verifymyclient/mcp-server
```

Or in your MCP client config:

```json
"env": {
  "VMC_API_TOKEN": "vmc_test_xxxxxxxxxxxxxxxx",
  "VMC_API_BASE": "https://test.verifymyclient.com/api/v1"
}
```

Test-environment invites and credits are entirely separate from production and no real verifications take place.

## Notes

- `create_invite` sends a unique `Idempotency-Key` header on every call, so a retried request will not double-charge credits.
- By default no email is sent to the client — your assistant receives the invite URL and you share it however you prefer. Pass `sendEmail: true` (with a client email) to have VerifyMyClient send it.
- API errors are returned to the assistant as readable messages including the API error code, e.g. `VerifyMyClient API error [insufficient_credits]: ...`.

## License

MIT
