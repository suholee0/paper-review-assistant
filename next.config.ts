import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@openai/codex-sdk"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
