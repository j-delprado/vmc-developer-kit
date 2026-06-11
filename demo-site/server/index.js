/**
 * ABC ACSP demo — Express proxy for the VerifyMyClient Partner API v1.
 *
 * The Partner API token lives ONLY in this process (env var VMC_DEMO_TOKEN).
 * The browser talks to /demo-api/* and never sees the token or the full
 * upstream payloads — responses are reduced to the minimal fields the demo
 * UI needs.
 *
 * Run with: node --env-file=.env index.js   (requires Node >= 20.6)
 */

import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.DEMO_PORT) || 4100;
const API_BASE = (process.env.VMC_API_BASE || "https://test.verifymyclient.com/api/v1").replace(/\/+$/, "");
const TOKEN = process.env.VMC_DEMO_TOKEN;

if (!TOKEN) {
  console.error("Fatal: VMC_DEMO_TOKEN is not set.");
  console.error("Start the server with: node --env-file=.env index.js");
  process.exit(1);
}

const app = express();
// The demo may run behind a reverse proxy in production; this makes req.ip
// honour X-Forwarded-For. Spoofable, but acceptable for a soft demo limit.
app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// Per-IP rate limit: max 5 invite creations per rolling hour (in-memory).
// NOTE: in-memory is fine for a single-process demo. In production behind a
// load balancer / multiple instances, back this with a shared store (Redis,
// Cloudflare rate-limiting, or your API gateway) so the limit is global.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const inviteHits = new Map(); // ip -> array of creation timestamps (ms)

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (inviteHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    inviteHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  inviteHits.set(ip, recent);
  return false;
}

// Prune stale entries so the Map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [ip, stamps] of inviteHits) {
    const recent = stamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) inviteHits.delete(ip);
    else inviteHits.set(ip, recent);
  }
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALLOWED_METHODS = new Set(["driving_licence", "passport_nfc"]);
const INVITE_ID_PATTERN = /^inv_[A-Za-z0-9]+$/;

function sanitizeName(raw) {
  return raw
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[<>]/g, "") // strip stray angle brackets
    .replace(/\s+/g, " ")
    .trim();
}

function sendError(res, httpStatus, code, message) {
  res.status(httpStatus).json({ error: { code, message } });
}

async function callPartnerApi(pathname, init = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/demo-api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/demo-api/invites", async (req, res) => {
  const ip = req.ip || "unknown";
  if (isRateLimited(ip)) {
    return sendError(res, 429, "rate_limited", "Demo limit reached for now — please try again in an hour.");
  }

  const { name, method } = req.body || {};
  if (typeof name !== "string") {
    return sendError(res, 400, "invalid_name", "Please provide a first name.");
  }
  const cleanName = sanitizeName(name);
  if (cleanName.length < 1 || cleanName.length > 80) {
    return sendError(res, 400, "invalid_name", "Name must be between 1 and 80 characters.");
  }
  if (!ALLOWED_METHODS.has(method)) {
    return sendError(res, 400, "invalid_method", 'Method must be "driving_licence" or "passport_nfc".');
  }

  try {
    const { response, body } = await callPartnerApi("/invites", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        client: { name: cleanName },
        verification_type: "idv",
        document_method: method,
        send_email: false,
        reference: `demo-${crypto.randomUUID().slice(0, 8)}`,
      }),
    });

    if (!response.ok) {
      if (response.status === 402) {
        return sendError(res, 402, "out_of_credits", "Demo is out of credits — contact us");
      }
      return sendError(
        res,
        response.status,
        body?.error?.code || "upstream_error",
        body?.error?.message || "Could not create the verification invite.",
      );
    }

    // Never forward the full upstream payload — only what the browser needs.
    return res.json({ id: body.id, invite_url: body.invite_url, status: body.status });
  } catch (err) {
    console.error("POST /demo-api/invites upstream failure:", err);
    return sendError(res, 502, "upstream_unreachable", "Verification service is unreachable. Please try again shortly.");
  }
});

app.get("/demo-api/invites/:id", async (req, res) => {
  const { id } = req.params;
  if (!INVITE_ID_PATTERN.test(id)) {
    return sendError(res, 400, "invalid_id", "Invalid invite id.");
  }

  try {
    const { response, body } = await callPartnerApi(`/invites/${id}`);
    if (!response.ok) {
      return sendError(
        res,
        response.status,
        body?.error?.code || "upstream_error",
        body?.error?.message || "Could not fetch the invite status.",
      );
    }
    return res.json({
      id: body.id,
      status: body.status,
      // invite_url lets returning visitors resume from the tracking flow
      invite_url: body.invite_url,
      // Step flags: true = finished, false = in progress, null = not part of
      // this verification type (the UI hides steps that are null).
      identity_completed: body.identity_completed ?? null,
      address_completed: body.address_completed ?? null,
      // CH registration is asynchronous — can land hours after completion
      ch_registered_at: body.ch_registered_at ?? null,
    });
  } catch (err) {
    console.error(`GET /demo-api/invites/${id} upstream failure:`, err);
    return sendError(res, 502, "upstream_unreachable", "Verification service is unreachable. Please try again shortly.");
  }
});

// ---------------------------------------------------------------------------
// Production: serve the built SPA from ../web/dist with index.html fallback.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  const distDir = path.resolve(__dirname, "../web/dist");
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/demo-api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`ABC ACSP demo proxy listening on http://localhost:${PORT}`);
  console.log(`Upstream Partner API: ${API_BASE}`);
});
