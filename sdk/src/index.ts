/**
 * @verifymyclient/sdk — typed client for the VerifyMyClient Partner API v1.
 *
 * Zero-dependency (uses the global `fetch`). The API token must stay
 * server-side — never ship it to a browser. Mirrors openapi/vmc-partner-api.v1.yaml.
 *
 *   import { VmcClient } from '@verifymyclient/sdk';
 *   const vmc = new VmcClient({ token: process.env.VMC_API_TOKEN! });
 *   const invite = await vmc.invites.create({
 *     client: { name: 'Jane Smith' },
 *     verification_type: 'idv',
 *     document_method: 'passport_nfc',
 *     reference: 'CRM-001',
 *   });
 *   console.log(invite.invite_url);
 */

export type VerificationType = 'idv' | 'idv_address' | 'address_only';
export type DocumentMethod = 'driving_licence' | 'passport_nfc' | 'passport_non_nfc' | 'client_choice';
export type InviteStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'expired' | 'failed';
export type CreatedVia = 'console' | 'api';
export type WebhookEventType =
  | 'invite.processing' | 'invite.completed' | 'invite.cancelled' | 'invite.expired' | 'invite.failed';

export interface Account {
  object: 'partner';
  partner_name: string;
  company_name: string | null;
  company_number: string | null;
  environment: 'test' | 'live';
  scopes: string[];
}

export interface Balance { object: 'balance'; credits_remaining: number }

export interface Invite {
  id: string;
  object: 'invite';
  invite_url: string;
  status: InviteStatus;
  verification_type: VerificationType;
  document_method: DocumentMethod;
  client: { name: string; email?: string | null };
  reference?: string | null;
  credits_charged?: number;
  identity_completed?: boolean | null;
  address_completed?: boolean | null;
  created_at: string;
  expires_at?: string | null;
  completed_at?: string | null;
  /** Asynchronous — can land hours after completed_at. */
  ch_registered_at?: string | null;
}

export interface CreateInviteParams {
  client: { name: string; email?: string };
  verification_type: VerificationType;
  document_method?: DocumentMethod;
  reference?: string;
  send_email?: boolean;
}

export interface ListInvitesParams {
  status?: InviteStatus;
  created_via?: CreatedVia;
  limit?: number;
}

export interface InviteReport {
  id: string;
  object: 'report';
  invite_status: string;
  session_status: string;
  verification_type: string;
  document_method: string;
  client: { name: string; email?: string | null };
  reference?: string | null;
  identity?: { status: 'PENDING' | 'PASSED' | 'FAILED'; completed_at?: string | null } | null;
  address?: { status: 'PENDING' | 'PASSED' | 'FAILED'; completed_at?: string | null } | null;
  report_data?: Record<string, unknown> | null;
  address_data?: Record<string, unknown> | null;
  report_ready_at?: string | null;
}

export interface WebhookEndpoint {
  id: string;
  object: 'webhook_endpoint';
  url: string;
  events: WebhookEventType[];
  is_active: boolean;
  created_at: string;
  /** Returned ONCE on create — store it to verify deliveries. */
  secret?: string;
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  created: number;
  data: { object: Invite };
}

export interface VmcClientOptions {
  /** Partner API token (vmc_test_… or vmc_live_…). Keep it server-side. */
  token: string;
  /** Defaults to production. Use https://test.verifymyclient.com/api/v1 for sandbox. */
  baseUrl?: string;
  /** Override fetch (e.g. for older Node or testing). */
  fetch?: typeof fetch;
}

/** Mirrors the API's { error: { type, code, message } } envelope. */
export class VmcError extends Error {
  readonly type: string;
  readonly code: string;
  readonly status: number;
  constructor(status: number, type: string, code: string, message: string) {
    super(message);
    this.name = 'VmcError';
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

function randomIdempotencyKey(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'idem_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class VmcClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(opts: VmcClientOptions) {
    if (!opts?.token) throw new Error('VmcClient: a token is required');
    this.token = opts.token;
    this.baseUrl = (opts.baseUrl || 'https://verifymyclient.com/api/v1').replace(/\/+$/, '');
    this._fetch = opts.fetch || globalThis.fetch;
    if (!this._fetch) throw new Error('VmcClient: no fetch available — pass options.fetch on older Node');
  }

  private async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data?.error || {};
      throw new VmcError(res.status, e.type || 'api_error', e.code || 'error', e.message || `Request failed (${res.status})`);
    }
    return data as T;
  }

  // ── Account ──
  me(): Promise<Account> { return this.request('GET', '/me'); }
  balance(): Promise<Balance> { return this.request('GET', '/balance'); }
  verificationMethods(): Promise<{ methods: unknown[] }> { return this.request('GET', '/verification-methods'); }

  // ── Invites ──
  invites = {
    create: (params: CreateInviteParams, opts?: { idempotencyKey?: string }): Promise<Invite> =>
      this.request('POST', '/invites', params, { 'Idempotency-Key': opts?.idempotencyKey || randomIdempotencyKey() }),
    get: (id: string): Promise<Invite> => this.request('GET', `/invites/${encodeURIComponent(id)}`),
    list: (params?: ListInvitesParams): Promise<{ object: 'list'; data: Invite[] }> => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.created_via) q.set('created_via', params.created_via);
      if (params?.limit != null) q.set('limit', String(params.limit));
      const qs = q.toString();
      return this.request('GET', `/invites${qs ? `?${qs}` : ''}`);
    },
    cancel: (id: string): Promise<{ id: string; object: 'invite'; status: 'cancelled'; credits_refunded: number }> =>
      this.request('DELETE', `/invites/${encodeURIComponent(id)}`),
    report: (id: string): Promise<InviteReport> => this.request('GET', `/invites/${encodeURIComponent(id)}/report`),
  };

  // ── Webhooks ──
  webhooks = {
    list: (): Promise<{ object: 'list'; data: WebhookEndpoint[] }> => this.request('GET', '/webhooks'),
    create: (url: string, events?: WebhookEventType[]): Promise<WebhookEndpoint> =>
      this.request('POST', '/webhooks', { url, ...(events ? { events } : {}) }),
    delete: (id: string): Promise<{ id: string; object: 'webhook_endpoint'; is_active: false }> =>
      this.request('DELETE', `/webhooks/${encodeURIComponent(id)}`),
  };
}

/**
 * Verify a webhook delivery's `X-VMC-Signature: t=<unix>,v1=<hex>` header.
 * Returns true only if the HMAC matches AND the timestamp is within tolerance.
 * Pass the RAW request body (string) — not the parsed object.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const kv of signatureHeader.split(',')) {
    const [k, v] = kv.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (!parts.t || !parts.v1) return false;
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < toleranceSeconds;
  if (!fresh) return false;

  const enc = new TextEncoder();
  const cryptoObj: any = (globalThis as any).crypto;
  const key = await cryptoObj.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await cryptoObj.subtle.sign('HMAC', key, enc.encode(`${parts.t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // Constant-time-ish compare.
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}
