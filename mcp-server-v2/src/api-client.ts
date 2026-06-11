/**
 * Minimal HTTP client for the VerifyMyClient Partner API v1.
 *
 * Uses the Node 18+ global fetch. Adds the Authorization header,
 * JSON encoding/decoding, and normalises every failure into the
 * API's error shape: { type, code, message }. Never throws — callers
 * always get back an ApiResult they can render for the model.
 */

import { config } from './config.js';

export interface ApiError {
  type: string;
  code: string;
  message: string;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  /** JSON request body (POST only). */
  body?: Record<string, unknown>;
  /** Query string parameters; undefined values are skipped. */
  query?: Record<string, string | number | undefined>;
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, headers: extraHeaders } = options;

  const url = new URL(`${config.apiBase}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiToken}`,
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: {
        type: 'network_error',
        code: 'network_error',
        message: `Could not reach the VerifyMyClient API at ${config.apiBase}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const apiError =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof (payload as { error: unknown }).error === 'object'
        ? ((payload as { error: Partial<ApiError> }).error)
        : undefined;

    return {
      ok: false,
      status: res.status,
      error: {
        type: apiError?.type ?? 'api_error',
        code: apiError?.code ?? `http_${res.status}`,
        message:
          apiError?.message ??
          `Request failed with HTTP ${res.status} ${res.statusText}`.trim(),
      },
    };
  }

  return { ok: true, status: res.status, data: payload as T };
}
