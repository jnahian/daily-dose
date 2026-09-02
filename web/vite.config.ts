import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The admin panel and contact form post to the bot's Express server
      // during local dev.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Scripts docs content and the auth-trigger route are served by the
      // bot's Express server behind Basic Auth (see src/app.js); proxy them
      // during local development so the browser's auth prompt works.
      "/scripts/data.json": "http://localhost:3000",
      "/scripts/auth": "http://localhost:3000",
      // MCP Slack sign-in and its OAuth callbacks (see src/app.js) — these sit
      // outside /api, so each needs its own rule or the SPA router swallows it
      // in dev. Listed individually on purpose: a bare "/mcp" prefix would also
      // capture the SPA's own /mcp-tokens route.
      "/mcp/login": "http://localhost:3000",
      "/mcp/cb": "http://localhost:3000",
      "/mcp/oauth/cb": "http://localhost:3000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router"],
          "animation-vendor": [
            "framer-motion",
            "lottie-web",
            "@lordicon/react",
          ],
        },
      },
    },
  },
});
