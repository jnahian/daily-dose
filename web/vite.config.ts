import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The contact form posts to the bot's Express server during local dev.
      "/api": "http://localhost:3000",
      // Scripts docs content and the auth-trigger route are served by the
      // bot's Express server behind Basic Auth (see src/app.js); proxy them
      // during local development so the browser's auth prompt works.
      "/scripts/data.json": "http://localhost:3000",
      "/scripts/auth": "http://localhost:3000",
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
