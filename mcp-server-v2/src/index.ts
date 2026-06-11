#!/usr/bin/env node

/**
 * VerifyMyClient Partner MCP Server
 *
 * Exposes the VerifyMyClient Partner API v1 as MCP tools so that an
 * accountant's AI assistant can:
 *   - create identity verification invites for clients and get a link to share
 *   - check the status of an invite, list invites, cancel an invite
 *   - fetch the verification report once a check completes
 *   - check the firm's credit balance and available verification methods
 *
 * Transport: stdio (for Claude Desktop, Claude Code, and other MCP clients).
 *
 * Environment:
 *   VMC_API_TOKEN  (required)  Partner API token (vmc_test_... or vmc_live_...)
 *   VMC_API_BASE   (optional)  Defaults to https://verifymyclient.com/api/v1
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { apiRequest, type ApiError } from './api-client.js';
import { config } from './config.js';

// ─── API response types ─────────────────────────────────────────────

interface Invite {
  id: string;
  invite_url?: string;
  status: string;
  verification_type: string;
  document_method?: string | null;
  client: { name: string; email?: string | null };
  reference?: string | null;
  credits_charged?: number;
  credits_remaining?: number;
  expires_at?: string | null;
  created_at?: string;
}

interface InviteList {
  data: Invite[];
  page: number;
  limit: number;
}

interface Balance {
  credits_remaining: number;
}

interface VerificationMethods {
  verification_types: { verification_type: string; label: string; credits: number }[];
  document_methods: { document_method: string; available: boolean; automated: boolean }[];
}

interface CancelResponse {
  id: string;
  status: string;
  credits_refunded: number;
}

// ─── Result helpers ─────────────────────────────────────────────────

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(error: ApiError) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `VerifyMyClient API error [${error.code}]: ${error.message}`,
      },
    ],
    isError: true,
  };
}

function formatInvite(invite: Invite): string {
  const lines = [
    `Invite ID: ${invite.id}`,
    `Status: ${invite.status}`,
    `Verification type: ${invite.verification_type}`,
  ];
  if (invite.document_method) lines.push(`Document method: ${invite.document_method}`);
  lines.push(
    `Client: ${invite.client.name}${invite.client.email ? ` <${invite.client.email}>` : ''}`,
  );
  if (invite.reference) lines.push(`Reference: ${invite.reference}`);
  if (invite.invite_url) lines.push(`Invite URL: ${invite.invite_url}`);
  if (invite.expires_at) lines.push(`Expires: ${invite.expires_at}`);
  if (invite.created_at) lines.push(`Created: ${invite.created_at}`);
  return lines.join('\n');
}

// ─── Create server ──────────────────────────────────────────────────

const server = new McpServer({
  name: 'verifymyclient-partner',
  version: '0.1.0',
});

// ─── create_invite ──────────────────────────────────────────────────

server.tool(
  'create_invite',
  'Create an identity verification invite for a client and get a secure link to share with them. ' +
    'Use this when the accountant needs a client to complete ID verification (IDV), ID + proof of address, or an address-only check. ' +
    'Each invite costs credits (see list_verification_methods for pricing). ' +
    'By default VerifyMyClient does NOT email the client — share the returned invite URL yourself, or set sendEmail to true.',
  {
    clientName: z.string().min(1).describe("The client's full name as it should appear on the verification (required)"),
    clientEmail: z
      .string()
      .email()
      .optional()
      .describe("The client's email address. Required if sendEmail is true; otherwise optional but recommended"),
    verificationType: z
      .enum(['idv', 'idv_address', 'address_only'])
      .default('idv')
      .describe(
        'What to verify: "idv" = identity document check (default), "idv_address" = identity plus proof of address, "address_only" = proof of address only',
      ),
    documentMethod: z
      .enum(['driving_licence', 'passport_nfc', 'client_choice'])
      .optional()
      .describe(
        'How the client proves their identity: "driving_licence", "passport_nfc" (NFC passport scan), or "client_choice" to let the client pick. Omit to use the account default',
      ),
    reference: z
      .string()
      .optional()
      .describe('Your own reference for this invite, e.g. an internal client code or matter number. Useful for filtering with list_invites'),
    sendEmail: z
      .boolean()
      .optional()
      .describe('If true, VerifyMyClient emails the invite link to the client directly (requires clientEmail). Defaults to false'),
  },
  async ({ clientName, clientEmail, verificationType, documentMethod, reference, sendEmail }) => {
    const body: Record<string, unknown> = {
      client: { name: clientName, ...(clientEmail ? { email: clientEmail } : {}) },
      verification_type: verificationType,
    };
    if (documentMethod) body.document_method = documentMethod;
    if (reference) body.reference = reference;
    if (sendEmail !== undefined) body.send_email = sendEmail;

    const result = await apiRequest<Invite>('/invites', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': randomUUID() },
    });

    if (!result.ok) return errorResult(result.error);

    const invite = result.data;
    const emailNote = sendEmail
      ? 'VerifyMyClient has emailed this link to the client.'
      : 'No email was sent — share this link with the client yourself.';

    return textResult(
      [
        'Verification invite created.',
        '',
        `>>> Invite link for the client: ${invite.invite_url}`,
        emailNote,
        '',
        formatInvite(invite),
        '',
        `Credits charged: ${invite.credits_charged ?? 'n/a'} (remaining: ${invite.credits_remaining ?? 'n/a'})`,
      ].join('\n'),
    );
  },
);

// ─── get_invite_status ──────────────────────────────────────────────

server.tool(
  'get_invite_status',
  'Check the current status of a verification invite by its ID. ' +
    'Statuses: pending (client has not started), processing (client is mid-verification), completed (done — report available via get_report), cancelled, expired.',
  {
    inviteId: z.string().min(1).describe('The invite ID returned by create_invite or list_invites'),
  },
  async ({ inviteId }) => {
    const result = await apiRequest<Invite>(`/invites/${encodeURIComponent(inviteId)}`);
    if (!result.ok) return errorResult(result.error);
    return textResult(formatInvite(result.data));
  },
);

// ─── list_invites ───────────────────────────────────────────────────

server.tool(
  'list_invites',
  'List verification invites, optionally filtered by status or by the reference you supplied when creating them. ' +
    'Results are paginated — use page and limit to fetch more.',
  {
    status: z
      .enum(['pending', 'processing', 'completed', 'cancelled', 'expired'])
      .optional()
      .describe('Only return invites with this status'),
    reference: z.string().optional().describe('Only return invites created with this exact reference'),
    page: z.number().int().min(1).optional().describe('Page number, starting at 1'),
    limit: z.number().int().min(1).max(100).optional().describe('Results per page'),
  },
  async ({ status, reference, page, limit }) => {
    const result = await apiRequest<InviteList>('/invites', {
      query: { status, reference, page, limit },
    });
    if (!result.ok) return errorResult(result.error);

    const { data, page: currentPage, limit: pageLimit } = result.data;
    if (!data || data.length === 0) {
      return textResult('No invites found matching these filters.');
    }

    const items = data
      .map((invite, i) => `${i + 1}. ${formatInvite(invite)}`)
      .join('\n\n');

    return textResult(
      `${data.length} invite(s) (page ${currentPage}, ${pageLimit} per page):\n\n${items}`,
    );
  },
);

// ─── cancel_invite ──────────────────────────────────────────────────

server.tool(
  'cancel_invite',
  'Cancel a verification invite that is no longer needed. ' +
    'Credits are refunded if the client had not yet completed the verification. The invite link stops working immediately.',
  {
    inviteId: z.string().min(1).describe('The ID of the invite to cancel'),
  },
  async ({ inviteId }) => {
    const result = await apiRequest<CancelResponse>(
      `/invites/${encodeURIComponent(inviteId)}`,
      { method: 'DELETE' },
    );
    if (!result.ok) return errorResult(result.error);

    const { id, status, credits_refunded } = result.data;
    return textResult(
      `Invite ${id} is now ${status}. Credits refunded: ${credits_refunded}.`,
    );
  },
);

// ─── get_report ─────────────────────────────────────────────────────

server.tool(
  'get_report',
  'Fetch the full verification report for an invite as JSON. ' +
    'Only available once the client has started the verification; for a completed invite this contains the verification outcome and checked details. ' +
    'If the report is not ready yet, this tells you so — check again after the client has completed the process.',
  {
    inviteId: z.string().min(1).describe('The ID of the invite to fetch the report for'),
  },
  async ({ inviteId }) => {
    const result = await apiRequest<Record<string, unknown>>(
      `/invites/${encodeURIComponent(inviteId)}/report`,
    );

    if (!result.ok) {
      if (result.error.code === 'report_not_ready') {
        return textResult(
          `Report not ready for invite ${inviteId}: ${result.error.message}\n` +
            'The client has not started the verification yet. Use get_invite_status to monitor progress and try again later.',
        );
      }
      return errorResult(result.error);
    }

    return textResult(
      `Verification report for invite ${inviteId}:\n\n${JSON.stringify(result.data, null, 2)}`,
    );
  },
);

// ─── get_balance ────────────────────────────────────────────────────

server.tool(
  'get_balance',
  "Check the firm's remaining VerifyMyClient credit balance. Each verification invite consumes credits (see list_verification_methods for how many).",
  {},
  async () => {
    const result = await apiRequest<Balance>('/balance');
    if (!result.ok) return errorResult(result.error);
    return textResult(`Credits remaining: ${result.data.credits_remaining}`);
  },
);

// ─── list_verification_methods ──────────────────────────────────────

server.tool(
  'list_verification_methods',
  'List the verification types available to this account with their credit cost, and the supported document methods. ' +
    'Use this before create_invite to choose the right verificationType and documentMethod and to know what an invite will cost.',
  {},
  async () => {
    const result = await apiRequest<VerificationMethods>('/verification-methods');
    if (!result.ok) return errorResult(result.error);

    const { verification_types, document_methods } = result.data;

    const typeLines = (verification_types ?? []).map(
      (t) => `- ${t.verification_type}: ${t.label} (${t.credits} credit${t.credits === 1 ? '' : 's'})`,
    );
    const methodLines = (document_methods ?? []).map(
      (m) =>
        `- ${m.document_method}: ${m.available ? 'available' : 'not available'}${m.automated ? ', automated' : ''}`,
    );

    return textResult(
      [
        'Verification types:',
        ...typeLines,
        '',
        'Document methods:',
        ...methodLines,
      ].join('\n'),
    );
  },
);

// ─── Start ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[vmc-mcp] VerifyMyClient Partner MCP server running on stdio (API: ${config.apiBase})`,
  );
}

main().catch((error) => {
  console.error('[vmc-mcp] Fatal error:', error);
  process.exit(1);
});
