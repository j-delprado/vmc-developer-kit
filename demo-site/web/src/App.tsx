/**
 * ABC ACSP — demo landing page.
 * Visuals converted from the approved Claude design (ABC ACSP.dc.html),
 * phone-mock hero variant. The verify flow modal (components/VerifyModal.tsx)
 * talks to the real Partner API through the demo proxy.
 */

import { useEffect, useRef, useState } from "react";
import VerifyModal from "./components/VerifyModal";
import Confetti from "./components/Confetti";
import { recallInvite, type DocumentMethod } from "./lib/demoApi";

const INK = "#10283F";
const IVORY = "#FAF7F2";
const BRASS = "#B08D3E";
const EMERALD = "#1B7F5C";
const SLATE = "#5B6B7B";

const eyebrow: React.CSSProperties = { fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: BRASS, fontWeight: 600 };
const serif = "'Playfair Display',serif";

// ── Method cards data ────────────────────────────────────────────────
const METHOD_CARDS: Array<{ key: DocumentMethod | "manual"; title: string; badge: string; kind: "emerald" | "amber"; desc: string }> = [
  { key: "driving_licence", title: "UK/EU driving licence", badge: "Fastest", kind: "emerald", desc: "Instant, fully automated. No app needed — verify in your browser." },
  { key: "passport_nfc", title: "Passport with chip", badge: "Instant · requires app", kind: "emerald", desc: "Any biometric passport or ID card. Scan the chip with the free Folio app." },
  { key: "manual", title: "Passport without chip", badge: "Reviewed by a person", kind: "amber", desc: "Upload your photo page and a selfie. One of our verification agents reviews it within one business day." },
];

const SERVICES = [
  { tag: "Formation", title: "Company formation", desc: "Incorporate cleanly, with PSCs and share structure right the first time." },
  { tag: "Annual", title: "Confirmation statements", desc: "We track the due date and file the CS01 so nothing lapses." },
  { tag: "Compliance", title: "PSC & director filings", desc: "Appointments, resignations and changes filed same-day." },
  { tag: "Identity", title: "Identity verification", desc: "ACSP-grade checks for every director and PSC, in minutes." },
  { tag: "Payroll", title: "Payroll & CIS", desc: "RTI submissions, payslips and CIS returns handled monthly." },
  { tag: "Reporting", title: "Management accounts", desc: "Quarterly numbers that actually help you make decisions." },
];

const STEPS = [
  { n: "1", title: "We send you a secure link", desc: "A branded link arrives by email and SMS from ABC ACSP — no account to create." },
  { n: "2", title: "You verify on your phone", desc: "Scan your licence or passport and take a quick selfie. About five minutes." },
  { n: "3", title: "We confirm and file", desc: "We receive the signed report and file your verified status with Companies House." },
];

function methodBadge(kind: "emerald" | "amber"): React.CSSProperties {
  if (kind === "emerald")
    return { display: "inline-block", background: "rgba(27,127,92,.12)", color: EMERALD, fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 999, letterSpacing: ".01em" };
  return { display: "inline-block", background: "rgba(176,141,62,.16)", color: "#9A7724", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 999, letterSpacing: ".01em" };
}

function MethodIcon({ kind }: { kind: string }) {
  const stroke = INK;
  if (kind === "driving_licence")
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <rect x="3" y="7" width="28" height="20" rx="3" stroke={stroke} strokeWidth="1.6" />
        <circle cx="11" cy="15" r="3" stroke={stroke} strokeWidth="1.6" />
        <line x1="18" y1="14" x2="27" y2="14" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="18" y1="19" x2="24" y2="19" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="8" y1="22" x2="14" y2="22" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (kind === "passport_nfc")
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <rect x="9" y="3" width="16" height="28" rx="3" stroke={stroke} strokeWidth="1.6" />
        <line x1="14" y1="27" x2="20" y2="27" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M19 12a4 4 0 0 1 0 8" stroke={BRASS} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M22 9a8 8 0 0 1 0 14" stroke={BRASS} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="12" r="5" stroke={stroke} strokeWidth="1.6" />
      <path d="M7 29c0-5.5 4.5-9 10-9s10 3.5 10 9" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Animated phone mock (hero) ───────────────────────────────────────
const PHONE_STEPS = [
  { title: "Secure link sent", sub: "from ABC ACSP" },
  { title: "Link opened", sub: "on Helena's phone" },
  { title: "Document scanned", sub: "UK driving licence" },
  { title: "Address confirmed", sub: "matched to your record" },
  { title: "Verified & filed", sub: "Companies House confirmed" },
];

function PhoneMock({ reduced }: { reduced: boolean }) {
  const [step, setStep] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (reduced) return;
    if (step >= 4) return;
    const t = setTimeout(() => setStep((s) => Math.min(4, s + 1)), 1150);
    return () => clearTimeout(t);
  }, [step, reduced]);

  return (
    <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
      <div style={{ position: "absolute", inset: "8% 14%", background: "radial-gradient(circle at 50% 35%,rgba(176,141,62,.16),transparent 70%)", filter: "blur(10px)" }} />
      <div style={{ position: "relative", width: 300, height: 600, background: INK, borderRadius: 42, padding: 13, boxShadow: "0 40px 90px -34px rgba(16,40,63,.55)", border: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", width: 96, height: 24, background: "#0b1b2c", borderRadius: 14, zIndex: 3 }} />
        <div style={{ width: "100%", height: "100%", background: IVORY, borderRadius: 30, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "38px 24px 20px", background: "#fff", borderBottom: "1px solid rgba(16,40,63,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", border: "1.4px solid #B08D3E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 13, color: BRASS }}>A</span>
              <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 600 }}>ABC ACSP</span>
            </div>
            <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: BRASS, fontWeight: 600, marginBottom: 5 }}>Director verification</div>
            <div style={{ fontFamily: serif, fontSize: 21, fontWeight: 600, lineHeight: 1.2 }}>Helena Whitmore</div>
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 3 }}>PSC · Whitmore Capital Ltd</div>
          </div>
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {PHONE_STEPS.map((d, idx) => {
              const done = step > idx || (step === 4 && idx === 4);
              const active = step === idx && !done;
              const isLast = idx === PHONE_STEPS.length - 1;
              const reached = done || active;
              let dot: React.CSSProperties;
              let mark = "";
              if (done) {
                dot = { width: 24, height: 24, borderRadius: "50%", background: EMERALD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" };
                mark = "✓";
              } else if (active) {
                dot = { width: 24, height: 24, borderRadius: "50%", border: "2px solid #B08D3E", background: "rgba(176,141,62,.14)", flex: "none", animation: "abcDot 1.1s ease-in-out infinite" };
              } else {
                dot = { width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(16,40,63,.2)", flex: "none" };
              }
              return (
                <div key={idx} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "4px 0" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                    <span style={dot}>{mark}</span>
                    {!isLast && <span style={{ width: 2, height: 30, background: step > idx ? EMERALD : "rgba(16,40,63,.12)" }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: reached ? INK : "rgba(16,40,63,.4)" }}>{d.title}</div>
                    <div style={{ fontSize: 11.5, color: SLATE, marginTop: 2 }}>{d.sub}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: "auto" }}>
              <div style={{ borderTop: "1px solid rgba(16,40,63,.08)", paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: SLATE }}>Powered by</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>VerifyMyClient</span>
              </div>
            </div>
          </div>
        </div>
        {step === 4 && !reduced && <Confetti burstKey="hero" />}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function App() {
  const [ribbon, setRibbon] = useState(true);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyMode, setVerifyMode] = useState<"verify" | "track">("verify");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [initialMethod, setInitialMethod] = useState<DocumentMethod>("driving_licence");
  const reduced = useRef(false);

  useEffect(() => {
    try {
      reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no-op */
    }
    // ?track=inv_… → open straight into the tracking flow (shareable link)
    const fromUrl = new URLSearchParams(window.location.search).get("track");
    if (fromUrl && /^inv_[A-Za-z0-9]+$/.test(fromUrl)) {
      setTrackId(fromUrl);
      setVerifyMode("track");
      setVerifyOpen(true);
    }
  }, []);

  const openVerify = (method?: DocumentMethod) => {
    if (method) setInitialMethod(method);
    setVerifyMode("verify");
    setVerifyOpen(true);
  };

  const openTrack = () => {
    // Same-device visitors resume their last verification automatically
    setTrackId(recallInvite()?.id ?? null);
    setVerifyMode("track");
    setVerifyOpen(true);
  };

  return (
    <div style={{ background: IVORY, color: INK, minHeight: "100vh", width: "100%", overflowX: "hidden" }}>
      {ribbon && (
        <div style={{ background: INK, color: IVORY, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "11px 22px", fontSize: 13.5, letterSpacing: ".01em", position: "relative" }}>
          <span style={{ opacity: 0.92 }}>
            Demo environment — don't use real client documents; all documents are deleted a few hours after capture · Built on the <strong style={{ fontWeight: 600, color: "#D8B872" }}>VerifyMyClient</strong> Partner API
          </span>
          <button onClick={() => setRibbon(false)} aria-label="Dismiss demo notice" style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: IVORY, opacity: 0.6, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
      )}

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(250,247,242,.86)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(16,40,63,.10)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: INK }}>
            <span style={{ width: 42, height: 42, borderRadius: "50%", border: "1.5px solid #B08D3E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 20, fontWeight: 600, color: BRASS }}>A</span>
            <span style={{ fontFamily: serif, fontSize: 23, fontWeight: 600, letterSpacing: ".01em", whiteSpace: "nowrap" }}>ABC ACSP</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <a className="abc-nav-link" href="#services" style={{ textDecoration: "none", color: INK, fontSize: 15, fontWeight: 500, opacity: 0.85 }}>Services</a>
            <a className="abc-nav-link" href="#why" style={{ textDecoration: "none", color: INK, fontSize: 15, fontWeight: 500, opacity: 0.85 }}>Why ABC</a>
            <button className="abc-nav-link" onClick={openTrack} style={{ background: "transparent", border: "none", color: INK, fontSize: 15, fontWeight: 500, opacity: 0.85, cursor: "pointer", fontFamily: "'Inter',sans-serif", padding: 0 }}>Track my verification</button>
            <button onClick={() => openVerify()} style={{ background: BRASS, color: IVORY, border: "none", padding: "12px 22px", borderRadius: 11, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 6px 18px rgba(176,141,62,.28)" }}>Verify my identity</button>
          </div>
        </div>
      </nav>

      {/* HERO (phone-mock variant) */}
      <header id="top" style={{ position: "relative", borderBottom: "1px solid rgba(16,40,63,.10)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 40px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 56, alignItems: "center", paddingBottom: 56, animation: "abcFadeUp .5s ease both" }}>
            <div>
              <div style={{ ...eyebrow, marginBottom: 22 }}>Identity verification for Companies House</div>
              <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: 64, lineHeight: 1.04, letterSpacing: "-.01em", margin: "0 0 26px" }}>
                Your filings,<br />verified in minutes.
              </h1>
              <p style={{ fontSize: 18.5, lineHeight: 1.62, color: SLATE, maxWidth: 500, margin: "0 0 38px" }}>
                Companies House now requires every director and PSC to verify their identity. As your ACSP, we handle it — you just need your driving licence or passport and five quiet minutes.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <button onClick={() => openVerify()} style={{ background: INK, color: IVORY, border: "none", padding: "16px 28px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 10px 26px rgba(16,40,63,.18)" }}>Verify my identity</button>
                <button onClick={openTrack} style={{ background: "transparent", color: INK, border: "1.5px solid rgba(16,40,63,.22)", padding: "16px 28px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Track my verification</button>
              </div>
            </div>
            <PhoneMock reduced={reduced.current} />
          </div>
        </div>

        {/* Trust strip */}
        <div style={{ borderTop: "1px solid rgba(16,40,63,.10)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "26px 40px", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {["Registered ACSP", "ICAEW practice", "UK GDPR compliant", "2,400+ directors verified"].map((t, i) => (
              <div key={t} style={{ textAlign: "center", fontSize: 13, letterSpacing: ".13em", textTransform: "uppercase", color: SLATE, fontWeight: 600, borderLeft: i > 0 ? "1px solid rgba(16,40,63,.12)" : "none" }}>{t}</div>
            ))}
          </div>
        </div>
      </header>

      {/* THREE WAYS */}
      <section style={{ borderBottom: "1px solid rgba(16,40,63,.10)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ ...eyebrow, marginBottom: 14 }}>Three ways to verify</div>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 44, lineHeight: 1.1, margin: 0 }}>Choose what's in your pocket.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 26 }}>
            {METHOD_CARDS.map((m) => (
              <div
                key={m.key}
                className="abc-method-card"
                onClick={() => openVerify(m.key === "manual" ? "driving_licence" : (m.key as DocumentMethod))}
                style={{ background: "#fff", border: "1px solid rgba(16,40,63,.10)", borderRadius: 16, padding: "32px 30px", cursor: "pointer" }}
              >
                <div style={{ marginBottom: 24 }}><MethodIcon kind={m.key} /></div>
                <h3 style={{ fontFamily: serif, fontSize: 23, fontWeight: 600, margin: "0 0 14px" }}>{m.title}</h3>
                <span style={methodBadge(m.kind)}>{m.badge}</span>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: SLATE, marginTop: 16, marginBottom: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ borderBottom: "1px solid rgba(16,40,63,.10)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: 58 }}>
            <div style={{ ...eyebrow, marginBottom: 14 }}>How it works</div>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 44, lineHeight: 1.1, margin: 0 }}>Three steps, about five minutes.</h2>
          </div>
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40 }}>
            <div style={{ position: "absolute", top: 27, left: "16%", right: "16%", height: 1, background: "rgba(176,141,62,.4)" }} />
            {STEPS.map((s) => (
              <div key={s.n} style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: IVORY, border: "1.5px solid #B08D3E", color: BRASS, fontFamily: serif, fontSize: 22, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>{s.n}</div>
                <h3 style={{ fontFamily: serif, fontSize: 21, fontWeight: 600, margin: "0 0 10px" }}>{s.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: SLATE, maxWidth: 280, margin: "0 auto" }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 13.5, color: SLATE, marginTop: 48, marginBottom: 0, opacity: 0.85 }}>
            The link arrives from ABC ACSP and takes about five minutes — no account, no app for licence checks.
          </p>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ borderBottom: "1px solid rgba(16,40,63,.10)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 40px" }}>
          <div style={{ marginBottom: 46 }}>
            <div style={{ ...eyebrow, marginBottom: 14 }}>Services</div>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 44, lineHeight: 1.1, margin: 0 }}>Everything a growing company files.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "rgba(16,40,63,.10)", border: "1px solid rgba(16,40,63,.10)", borderRadius: 16, overflow: "hidden" }}>
            {SERVICES.map((sv) => (
              <div key={sv.title} className="abc-service-tile" style={{ background: IVORY, padding: "34px 30px" }}>
                <div style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", color: BRASS, fontWeight: 600, marginBottom: 10 }}>{sv.tag}</div>
                <h3 style={{ fontFamily: serif, fontSize: 21, fontWeight: 600, margin: "0 0 8px" }}>{sv.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: SLATE, margin: 0 }}>{sv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section id="why" style={{ background: INK, color: IVORY }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "96px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: serif, fontSize: 80, lineHeight: 0, color: BRASS, height: 36 }}>“</div>
          <blockquote style={{ fontFamily: serif, fontWeight: 500, fontSize: 36, lineHeight: 1.34, letterSpacing: "-.005em", margin: "0 0 34px" }}>
            I expected the usual scramble of forms and chasing emails. Instead ABC sent one link, I scanned my licence on the train, and the filing was confirmed before I reached the office.
          </blockquote>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(176,141,62,.22)", border: "1px solid rgba(176,141,62,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, color: "#D8B872", fontSize: 18 }}>JR</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>James Ruddock</div>
              <div style={{ fontSize: 14, color: "#9DB0C2" }}>Director · Ruddock & Hale Ltd</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: INK, color: IVORY, borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "54px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 34, lineHeight: 1.15, margin: 0 }}>Five minutes now saves a rejected filing later.</h2>
          <button onClick={() => openVerify()} style={{ background: BRASS, color: IVORY, border: "none", padding: "17px 34px", borderRadius: 12, fontSize: 16.5, fontWeight: 600, cursor: "pointer", boxShadow: "0 10px 26px rgba(176,141,62,.32)", flex: "none" }}>Verify my identity</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0c2032", color: "#9DB0C2" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 40px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap", paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ maxWidth: 340 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", border: "1.4px solid #B08D3E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, color: "#D8B872", fontSize: 17 }}>A</span>
                <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: IVORY }}>ABC ACSP</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>Chartered certainty. Boutique London accountants and a registered Authorised Corporate Service Provider.</p>
            </div>
            <div style={{ display: "flex", gap: 64, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "#6E8398", fontWeight: 600, marginBottom: 14 }}>Firm</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 14 }}><span>Services</span><span>Why ABC</span><span>Contact</span></div>
              </div>
              <div>
                <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "#6E8398", fontWeight: 600, marginBottom: 14 }}>Legal</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 14 }}><span>Privacy</span><span>ICAEW ref C0042817</span><span>Terms</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", paddingTop: 26 }}>
            <div style={{ fontSize: 13, color: "#6E8398" }}>12 Bedford Row, London WC1R 4BA · A demo by ABC ACSP</div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 13 }}>
              <span style={{ color: "#8AA0B4" }}>
                This demo is built on the <strong style={{ color: "#D8B872", fontWeight: 600 }}>VerifyMyClient</strong> Partner API
              </span>
              <a href="https://verifymyclient.com" target="_blank" rel="noreferrer" style={{ color: "#D8B872", textDecoration: "none", fontWeight: 500, borderBottom: "1px solid rgba(216,184,114,.4)", paddingBottom: 1 }}>Become a partner →</a>
            </div>
          </div>
        </div>
      </footer>

      <VerifyModal open={verifyOpen} mode={verifyMode} initialMethod={initialMethod} initialTrackId={trackId} onClose={() => setVerifyOpen(false)} />
    </div>
  );
}
