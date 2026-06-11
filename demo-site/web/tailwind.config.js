/**
 * Brand colors live under the `brand` namespace (bg-brand-ink, text-brand-slate, ...)
 * so they never clobber Tailwind's built-in palettes. The same hex values are
 * exported for JS use from src/theme/tokens.ts — keep both in sync.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#10283F",
          ivory: "#FAF7F2",
          brass: "#B08D3E",
          emerald: "#1B7F5C",
          slate: "#5B6B7B",
        },
      },
    },
  },
  plugins: [],
};
