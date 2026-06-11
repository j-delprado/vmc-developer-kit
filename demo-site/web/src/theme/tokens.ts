/**
 * ABC ACSP brand tokens.
 *
 * The designed landing page will consume these. The same hex values are
 * registered in tailwind.config.js under the `brand` namespace
 * (bg-brand-ink, text-brand-slate, ...) — keep both in sync.
 */
export const tokens = {
  ink: "#10283F",
  ivory: "#FAF7F2",
  brass: "#B08D3E",
  emerald: "#1B7F5C",
  slate: "#5B6B7B",
} as const;

export type BrandToken = keyof typeof tokens;
