import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Scripts docs content is served by the bot's Express server behind
      // Basic Auth (see src/app.js); proxy it during local development.
      "/scripts/data.json": "http://localhost:3000",
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
