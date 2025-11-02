import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Production optimizations
  poweredByHeader: false,
  reactStrictMode: true,

  // Turbopack configuration
  turbopack: {
    // Set root to avoid warning about multiple lockfiles
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
