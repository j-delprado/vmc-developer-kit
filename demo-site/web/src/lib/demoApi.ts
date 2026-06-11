/**
 * Typed fetch helpers for the demo proxy (/demo-api).
 *
 * The browser only ever talks to the Express proxy in ../server — the
 * Partner API token never reaches this code.
 */

export type DocumentMethod = "driving_licence" | "passport_nfc";

export type InviteStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired"
  | "failed";

export interface CreateInviteResponse {
  id: string;
  invite_url: string;
  status: InviteStatus;
}

export interface InviteStatusResponse {
  id: string;
  status: InviteStatus;
  invite_url: string;
  /** true = finished, false = in progress, null = not part of this verification type */
  identity_completed: boolean | null;
  address_completed: boolean | null;
  /** Companies House registration is asynchronous — null until the ACSP files it */
  ch_registered_at: string | null;
}

const STORAGE_KEY = "abc-demo-invite";

export function rememberInvite(id: string, name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name, savedAt: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function recallInvite(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export class DemoApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
  ) {
    super(message);
    this.name = "DemoApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/demo-api${path}`, init);
  const data: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new DemoApiError(
      data?.error?.code ?? "unknown_error",
      data?.error?.message ?? "Something went wrong. Please try again.",
      res.status,
    );
  }
  return data as T;
}

export function createInvite(name: string, method: DocumentMethod): Promise<CreateInviteResponse> {
  return request<CreateInviteResponse>("/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, method }),
  });
}

export function getInviteStatus(id: string): Promise<InviteStatusResponse> {
  return request<InviteStatusResponse>(`/invites/${encodeURIComponent(id)}`);
}
