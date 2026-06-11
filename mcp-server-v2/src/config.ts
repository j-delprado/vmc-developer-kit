/**
 * Configuration for the VerifyMyClient Partner MCP server.
 *
 * Read from environment variables:
 *   VMC_API_TOKEN  (required)  Partner API token, e.g. vmc_test_... or vmc_live_...
 *   VMC_API_BASE   (optional)  API base URL. Defaults to the production API.
 *                              Use https://test.verifymyclient.com/api/v1 for sandbox.
 */

const DEFAULT_API_BASE = 'https://verifymyclient.com/api/v1';

const token = process.env.VMC_API_TOKEN;

if (!token) {
  console.error(
    '[vmc-mcp] Missing required environment variable VMC_API_TOKEN.\n' +
      '[vmc-mcp] Set it to your VerifyMyClient Partner API token (looks like vmc_test_... or vmc_live_...).\n' +
      '[vmc-mcp] Example:\n' +
      '[vmc-mcp]   VMC_API_TOKEN=vmc_test_xxxxxxxx npx @verifymyclient/mcp-server',
  );
  process.exit(1);
}

export const config = {
  /** Partner API token, sent as `Authorization: Bearer <token>`. */
  apiToken: token,

  /** Base URL of the Partner API, no trailing slash. */
  apiBase: (process.env.VMC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, ''),
} as const;
