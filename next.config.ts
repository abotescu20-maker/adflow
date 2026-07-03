import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin has dynamic requires + optional native deps that the
  // serverless bundler mis-traces, causing runtime 500s in API routes. Keeping it
  // external (loaded from node_modules at runtime, not bundled) is the supported
  // fix. (02.07.2026)
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
