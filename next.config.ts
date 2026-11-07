import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  serverExternalPackages: ["better-sqlite3", "pg", "nodemailer"],
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
