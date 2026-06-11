import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /demo-api to the Express token-holding proxy so the
// browser never needs to know about the Partner API (or its token).
export default defineConfig({
  // Standalone (public dev kit): served at root, base "/". The in-app build on
  // the main VMC app overrides this to "/abc-demo/" via VITE_BASE at build time.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    proxy: {
      "/demo-api": {
        target: "http://localhost:4100",
        changeOrigin: true,
      },
    },
  },
});
