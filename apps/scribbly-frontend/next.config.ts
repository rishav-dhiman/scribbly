import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🧩 Compile the shared TSX package instead of expecting prebuilt JS
  transpilePackages: ["@repo/ui"],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
