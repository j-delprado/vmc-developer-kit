/**
 * The verify flow modal — visuals from the approved ABC ACSP design, wired to
 * the REAL Partner API through the demo proxy.
 *
 * Journey modelling: identity verification completes in minutes, but
 * Companies House registration is ASYNCHRONOUS (often hours later). The final
 * timeline stage reflects that, and the modal supports a "track" mode so
 * clients can close the page and come back: same-device visits auto-resume
 * from localStorage, any device can use the tracking reference (inv_…) or a
 * ?track= link.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createInvite,
  getInviteStatus,
  rememberInvite,
  DemoApiError,
  type DocumentMethod,
  type InviteStatus,
} from "../lib/demoApi";
import Confetti from "./Confetti";

const POLL_INTERVAL_MS = 5_000;
const POLL_CUTOFF_MS = 15 * 60 * 1000;

type Step = "details" | "method" | "status" | "track";

interface MethodDef {
  key: DocumentMethod | "manual";
  title: string;
  badge: string;
  kind: "emerald" | "amber";
  desc: string;
  disabled?: boolean;
}

const METHODS: MethodDef[] = [
  { key: "driving_licence", title: "UK/EU driving licence", badge: "Fastest", kind: "emerald", desc: "Instant, fully automated. No app needed — verify in your browser." },
  { key: "passport_nfc", title: "Passport with chip", badge: "Instant · requires app", kind: "emerald", desc: "Any biometric passport or ID card. Scan the chip with the free Folio app." },
  { key: "manual", title: "Passport without chip", badge: "Reviewed by a person", kind: "amber", desc: "Upload your photo page and a selfie. Reviewed within one business day. Coming soon to the demo.", disabled: true },
];

function badgeStyle(kind: "emerald" | "amber"): React.CSSProperties {
  if (kind === "emerald")
    return { display: "inline-block", background: "rgba(27,127,92,.12)", color: "#1B7F5C", fontSize: "12.5px", fontWeight: 600, padding: "5px 12px", borderRadius: "999px", letterSpacing: ".01em" };
  return { display: "inline-block", background: "rgba(176,141,62,.16)", color: "#9A7724", fontSize: "12.5px", fontWeight: 600, padding: "5px 12px", borderRadius: "999px", letterSpacing: ".01em" };
}

interface Props {
  open: boolean;
  mode: "verify" | "track";
  initialMethod?: DocumentMethod;
  initialTrackId?: string | null;
  onClose: () => void;
}

export default function VerifyModal({ open, mode, initialMethod, initialTrackId, onClose }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<DocumentMethod>(initialMethod ?? "driving_licence");
  const [invite, setInvite] = useState<{ id: string; invite_url: string } | null>(null);
  const [status, setStatus] = useState<InviteStatus>("pending");
  const [identityDone, setIdentityDone] = useState<boolean | null>(false);
  const [chRegisteredAt, setChRegisteredAt] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<DemoApiError | null>(null);
  const [trackInput, setTrackInput] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    try {
      reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no-op */
    }
  }, []);

  const checkReference = useCallback(async (reference: string) => {
    const ref = reference.trim();
    if (!/^inv_[A-Za-z0-9]+$/.test(ref)) {
      setTrackError("That doesn't look like a tracking reference (inv_…).");
      return;
    }
    setTracking(true);
    setTrackError(null);
    try {
      const found = await getInviteStatus(ref);
      setInvite({ id: found.id, invite_url: found.invite_url });
      setStatus(found.status);
      setIdentityDone(found.identity_completed);
      setChRegisteredAt(found.ch_registered_at);
      setStep("status");
    } catch (err) {
      setTrackError(
        err instanceof DemoApiError && err.httpStatus === 404
          ? "We couldn't find a verification with that reference."
          : "Couldn't check right now — please try again shortly.",
      );
    } finally {
      setTracking(false);
    }
  }, []);

  // Reset when (re)opened
  useEffect(() => {
    if (!open) return;
    setInvite(null);
    setStatus("pending");
    setIdentityDone(false);
    setChRegisteredAt(null);
    setError(null);
    setCopied(false);
    setRefCopied(false);
    setTimedOut(false);
    setTrackError(null);
    if (mode === "track") {
      setStep("track");
      const ref = initialTrackId || "";
      setTrackInput(ref);
      if (ref) void checkReference(ref);
    } else {
      setStep("details");
      if (initialMethod) setMethod(initialMethod);
    }
  }, [open, mode, initialMethod, initialTrackId, checkReference]);

  // Poll the real invite status while the modal is open
  useEffect(() => {
    if (!open || !invite) return;
    const fullyDone = status === "completed" && chRegisteredAt !== null;
    if (fullyDone || status === "failed" || status === "cancelled" || status === "expired") return;

    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_CUTOFF_MS) {
        setTimedOut(true);
        clearInterval(timer);
        return;
      }
      try {
        const next = await getInviteStatus(invite.id);
        setStatus(next.status);
        setIdentityDone(next.identity_completed);
        setChRegisteredAt(next.ch_registered_at);
      } catch {
        /* transient poll failures are fine — keep trying until cutoff */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, invite, status, chRegisteredAt]);

  const startVerification = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createInvite(firstName.trim(), method);
      setInvite({ id: created.id, invite_url: created.invite_url });
      setStatus(created.status);
      rememberInvite(created.id, firstName.trim());
      setStep("status");
    } catch (err) {
      setError(err instanceof DemoApiError ? err : new DemoApiError("unknown_error", "Something went wrong. Please try again.", 500));
      setStep("status");
    } finally {
      setCreating(false);
    }
  }, [firstName, method]);

  const copyText = useCallback((text: string, setFlag: (v: boolean) => void) => {
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 1800);
  }, []);

  if (!open) return null;

  const stepIdx = step === "details" ? 0 : step === "method" ? 1 : 2;
  const canContinue = firstName.trim().length > 0;
  const isBusyError = error && (error.httpStatus === 429 || error.httpStatus === 402);

  // ── Timeline model ───────────────────────────────────────────────────
  // Identity verification resolves in minutes; CH registration is async and
  // can take hours — its stage stays "waiting" with honest copy.
  const CH = 5;
  const verified = status === "completed";
  const registered = verified && chRegisteredAt !== null;
  const cur = registered ? 6 : verified ? CH : status === "processing" ? (identityDone === true ? 3 : 2) : 1;
  const timeline = [
    { title: "Link created", sub: "ready to open on any device", i: 0 },
    { title: "Link opened", sub: "on your device", i: 1 },
    { title: "Document checked", sub: "reading your document", i: 2 },
    { title: "Address confirmed", sub: "matched from bank or utility", i: 3 },
    { title: "Verified", sub: "your identity is confirmed", i: 4 },
    { title: "Registered in Companies House", sub: "you'll receive your personal code soon", i: CH },
  ].map((d) => {
    const done = cur > d.i;
    const isChWaiting = d.i === CH && verified && !registered;
    const active = !done && (cur === d.i || isChWaiting);
    const isLast = d.i === CH;
    let dotStyle: React.CSSProperties;
    let dotMark = "";
    if (done) {
      dotStyle = { width: 22, height: 22, borderRadius: "50%", background: "#1B7F5C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none", ...(d.i >= 4 ? { animation: "abcCheck .5s ease both" } : {}) };
      dotMark = "✓";
    } else if (isChWaiting) {
      dotStyle = { width: 22, height: 22, borderRadius: "50%", background: "#9A7724", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none" };
      dotMark = "⏱";
    } else if (active) {
      dotStyle = { width: 22, height: 22, borderRadius: "50%", border: "2px solid #B08D3E", background: "rgba(176,141,62,.14)", flex: "none", animation: "abcDot 1.1s ease-in-out infinite" };
    } else {
      dotStyle = { width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(16,40,63,.2)", flex: "none" };
    }
    const reached = done || active;
    return { ...d, dotStyle, dotMark, isLast, done, titleColor: reached ? "#10283F" : "rgba(16,40,63,.4)" };
  });

  const statusEyebrow = registered ? "Registered" : verified ? "Verified — registration pending" : error ? "Something went wrong" : "Live status";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,20,32,.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "abcRise .25s ease both" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#FAF7F2", width: "100%", maxWidth: 560, borderRadius: 22, boxShadow: "0 50px 110px -30px rgba(8,20,32,.6)", overflow: "hidden", position: "relative", animation: "abcFadeUp .3s ease both" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 28px", borderBottom: "1px solid rgba(16,40,63,.10)", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", border: "1.4px solid #B08D3E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", color: "#B08D3E", fontSize: 15 }}>A</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "#10283F" }}>
              {mode === "track" ? "Track your verification" : "Verify with ABC ACSP"}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#5B6B7B", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* progress (verify mode only) */}
        {mode === "verify" && (
          <div style={{ display: "flex", gap: 6, padding: "16px 28px 0" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= stepIdx ? "#B08D3E" : "rgba(16,40,63,.14)", transition: "background .3s ease" }} />
            ))}
          </div>
        )}

        <div style={{ padding: "26px 28px 30px" }}>
          {/* TRACK ENTRY */}
          {step === "track" && (
            <div style={{ animation: "abcRise .25s ease both" }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#B08D3E", fontWeight: 600, marginBottom: 8 }}>Check your status any time</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 27, fontWeight: 600, margin: "0 0 6px", color: "#10283F" }}>Welcome back.</h3>
              <p style={{ fontSize: 15, color: "#5B6B7B", margin: "0 0 24px" }}>
                Enter your tracking reference — it starts with <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 13.5 }}>inv_</code> and was shown when you started. On this device we may have remembered it for you.
              </p>
              <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#10283F", marginBottom: 7 }}>Tracking reference</label>
              <input
                className="abc-input"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="inv_…"
                style={{ width: "100%", padding: "14px 16px", border: "1.5px solid rgba(16,40,63,.18)", borderRadius: 11, fontFamily: "ui-monospace,monospace", fontSize: 14.5, color: "#10283F", background: "#fff", marginBottom: trackError ? 10 : 24 }}
              />
              {trackError && <p style={{ fontSize: 13.5, color: "#A14040", margin: "0 0 18px" }}>{trackError}</p>}
              <button
                onClick={() => void checkReference(trackInput)}
                disabled={tracking}
                style={{ width: "100%", border: "none", padding: "15px 22px", borderRadius: 11, fontSize: 15.5, fontWeight: 600, cursor: tracking ? "wait" : "pointer", background: "#10283F", color: "#FAF7F2", opacity: tracking ? 0.7 : 1 }}
              >
                {tracking ? "Checking…" : "Check status"}
              </button>
            </div>
          )}

          {/* STEP 1: DETAILS */}
          {step === "details" && (
            <div style={{ animation: "abcRise .25s ease both" }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#B08D3E", fontWeight: 600, marginBottom: 8 }}>Step 1 of 3 · Your details</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 27, fontWeight: 600, margin: "0 0 6px", color: "#10283F" }}>Let's get you verified.</h3>
              <p style={{ fontSize: 15, color: "#5B6B7B", margin: "0 0 24px" }}>We'll only use this to label your secure verification link.</p>
              <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#10283F", marginBottom: 7 }}>First name</label>
              <input
                className="abc-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Helena"
                maxLength={80}
                style={{ width: "100%", padding: "14px 16px", border: "1.5px solid rgba(16,40,63,.18)", borderRadius: 11, fontFamily: "'Inter',sans-serif", fontSize: 15.5, color: "#10283F", background: "#fff", marginBottom: 18 }}
              />
              <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#10283F", marginBottom: 7 }}>
                Email <span style={{ color: "#5B6B7B", fontWeight: 400 }}>· optional, not stored in this demo</span>
              </label>
              <input
                className="abc-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.uk"
                style={{ width: "100%", padding: "14px 16px", border: "1.5px solid rgba(16,40,63,.18)", borderRadius: 11, fontFamily: "'Inter',sans-serif", fontSize: 15.5, color: "#10283F", background: "#fff", marginBottom: 26 }}
              />
              <button
                onClick={() => canContinue && setStep("method")}
                style={{ width: "100%", border: "none", padding: "15px 22px", borderRadius: 11, fontSize: 15.5, fontWeight: 600, cursor: canContinue ? "pointer" : "not-allowed", background: canContinue ? "#10283F" : "rgba(16,40,63,.25)", color: "#FAF7F2", transition: "background .2s ease" }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* STEP 2: METHOD */}
          {step === "method" && (
            <div style={{ animation: "abcRise .25s ease both" }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#B08D3E", fontWeight: 600, marginBottom: 8 }}>Step 2 of 3 · Choose a method</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 27, fontWeight: 600, margin: "0 0 6px", color: "#10283F" }}>
                What's in your pocket{firstName.trim() ? `, ${firstName.trim()}` : ""}?
              </h3>
              <p style={{ fontSize: 15, color: "#5B6B7B", margin: "0 0 22px" }}>Pick the document you have to hand.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {METHODS.map((m) => {
                  const sel = !m.disabled && method === m.key;
                  return (
                    <div
                      key={m.key}
                      onClick={() => !m.disabled && setMethod(m.key as DocumentMethod)}
                      style={{
                        display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 16px", borderRadius: 13,
                        cursor: m.disabled ? "not-allowed" : "pointer", opacity: m.disabled ? 0.55 : 1,
                        border: `1.5px solid ${sel ? "#B08D3E" : "rgba(16,40,63,.14)"}`,
                        background: sel ? "rgba(176,141,62,.07)" : "#fff", transition: "all .16s ease",
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${sel ? "#B08D3E" : "rgba(16,40,63,.28)"}`, background: sel ? "#B08D3E" : "transparent" }}>
                        {sel && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: "#10283F" }}>{m.title}</span>
                          <span style={badgeStyle(m.kind)}>{m.badge}</span>
                        </div>
                        <div style={{ fontSize: 13.5, color: "#5B6B7B", marginTop: 4, lineHeight: 1.5 }}>{m.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setStep("details")} style={{ background: "transparent", color: "#10283F", border: "1.5px solid rgba(16,40,63,.2)", padding: "15px 22px", borderRadius: 11, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Back</button>
                <button
                  onClick={() => void startVerification()}
                  disabled={creating}
                  style={{ flex: 1, background: "#10283F", color: "#FAF7F2", border: "none", padding: "15px 22px", borderRadius: 11, fontSize: 15, fontWeight: 600, cursor: creating ? "wait" : "pointer", opacity: creating ? 0.7 : 1 }}
                >
                  {creating ? "Creating your secure link…" : "Start verification"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: STATUS */}
          {step === "status" && (
            <div style={{ animation: "abcRise .25s ease both" }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#B08D3E", fontWeight: 600, marginBottom: 18 }}>
                {mode === "track" ? statusEyebrow : `Step 3 of 3 · ${statusEyebrow}`}
              </div>

              {error ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: isBusyError ? "rgba(176,141,62,.1)" : "rgba(180,52,52,.07)", border: `1px solid ${isBusyError ? "rgba(176,141,62,.32)" : "rgba(180,52,52,.3)"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: isBusyError ? "#9A7724" : "#A14040", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flex: "none" }}>{isBusyError ? "⏱" : "!"}</span>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: "#10283F" }}>{isBusyError ? "The demo is busy right now" : "We couldn't create your link"}</div>
                      <div style={{ fontSize: 13, color: "#5B6B7B" }}>{isBusyError ? "Please try again in a little while — or talk to us about a live walkthrough." : error.message}</div>
                    </div>
                  </div>
                  <button onClick={() => setStep("method")} style={{ background: "#10283F", color: "#FAF7F2", border: "none", padding: "14px 22px", borderRadius: 11, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Try again</button>
                </div>
              ) : invite ? (
                <>
                  <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "none" }}>
                      <div style={{ background: "#fff", border: "1px solid rgba(16,40,63,.12)", borderRadius: 14, padding: 14, boxShadow: "0 14px 32px -22px rgba(16,40,63,.4)" }}>
                        <QRCodeSVG value={invite.invite_url} size={124} fgColor="#10283F" bgColor="transparent" />
                      </div>
                      <div style={{ textAlign: "center", fontSize: 12, color: "#5B6B7B", marginTop: 9 }}>Scan to continue on your phone</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#10283F", marginBottom: 8 }}>Or open your secure link</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                        <div style={{ flex: 1, background: "#fff", border: "1.5px solid rgba(16,40,63,.16)", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, color: "#5B6B7B", fontFamily: "ui-monospace,monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {invite.invite_url}
                        </div>
                        <button
                          onClick={() => copyText(invite.invite_url, setCopied)}
                          style={{ flex: "none", border: `1.5px solid ${copied ? "#1B7F5C" : "rgba(16,40,63,.18)"}`, background: copied ? "rgba(27,127,92,.1)" : "#fff", color: copied ? "#1B7F5C" : "#10283F", padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .18s ease" }}
                        >
                          {copied ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {timeline.map((t) => (
                          <div key={t.i} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                              <span style={t.dotStyle}>{t.dotMark}</span>
                              {!t.isLast && <span style={{ width: 2, height: 22, background: t.done ? "#1B7F5C" : "rgba(16,40,63,.12)" }} />}
                            </div>
                            <div style={{ paddingBottom: 14 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: t.titleColor }}>{t.title}</div>
                              <div style={{ fontSize: 12.5, color: "#5B6B7B", marginTop: 2 }}>{t.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* tracking reference — close the page, come back any time */}
                  <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(176,141,62,.06)", border: "1px dashed rgba(176,141,62,.45)", borderRadius: 11, padding: "11px 14px" }}>
                    <span style={{ fontSize: 12.5, color: "#5B6B7B" }}>Your tracking reference</span>
                    <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: "#10283F", fontWeight: 600 }}>{invite.id}</code>
                    <button
                      onClick={() => copyText(`${window.location.origin}/?track=${invite.id}`, setRefCopied)}
                      style={{ marginLeft: "auto", border: `1.5px solid ${refCopied ? "#1B7F5C" : "rgba(16,40,63,.18)"}`, background: refCopied ? "rgba(27,127,92,.1)" : "#fff", color: refCopied ? "#1B7F5C" : "#10283F", padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .18s ease" }}
                    >
                      {refCopied ? "Link copied ✓" : "Copy tracking link"}
                    </button>
                    <span style={{ flexBasis: "100%", fontSize: 12, color: "#5B6B7B" }}>
                      Registration with Companies House can take a few hours — you can safely close this page and check back with "Track my verification".
                    </span>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    {registered ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(27,127,92,.1)", border: "1px solid rgba(27,127,92,.3)", borderRadius: 12, padding: "14px 16px" }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#1B7F5C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flex: "none" }}>✓</span>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#10283F" }}>Registered with Companies House.</div>
                          <div style={{ fontSize: 13, color: "#5B6B7B" }}>Look out for your personal code from Companies House — you'll need it for future filings.</div>
                        </div>
                      </div>
                    ) : verified ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(27,127,92,.1)", border: "1px solid rgba(27,127,92,.3)", borderRadius: 12, padding: "14px 16px" }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#1B7F5C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flex: "none" }}>✓</span>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#10283F" }}>Verified — ABC ACSP is registering you with Companies House.</div>
                          <div style={{ fontSize: 13, color: "#5B6B7B" }}>This usually completes within a few hours. You'll receive your personal code soon — no need to keep this page open.</div>
                        </div>
                      </div>
                    ) : timedOut ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid rgba(16,40,63,.12)", borderRadius: 12, padding: "13px 16px" }}>
                        <span style={{ fontSize: 13.5, color: "#5B6B7B" }}>Still in progress — your link stays valid. Close this page and check back later with your tracking reference.</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid rgba(16,40,63,.12)", borderRadius: 12, padding: "13px 16px" }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #B08D3E", borderTopColor: "transparent", display: "inline-block", animation: reduced.current ? "none" : "abcSpin .8s linear infinite", flex: "none" }} />
                        <span style={{ fontSize: 13.5, color: "#5B6B7B" }}>Live — this status updates automatically as you verify.</span>
                      </div>
                    )}
                  </div>
                  {verified && !reduced.current && <Confetti burstKey="modal" />}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
