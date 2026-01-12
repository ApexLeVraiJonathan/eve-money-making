import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const config: NextConfig = {
    reactStrictMode: true,
    env: {
      NEXT_PUBLIC_APP_ENV:
        process.env.APP_ENV ?? process.env.NODE_ENV ?? "prod",
      NEXT_PUBLIC_API_URL:
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
      NEXT_PUBLIC_WEB_BASE_URL:
        process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3001",
    },
  };

  // Prevent `next build` and `next dev --turbopack` from racing on the same `.next/`
  // directory (common on Windows when a build happens while the dev server is running).
  //
  // We intentionally keep production *build* output separate from production *runtime*
  // so `next build` can run while the prod server is up without racing on the same
  // folder (common on Windows).
  if (phase === PHASE_PRODUCTION_BUILD) {
    config.distDir = ".next-build";
  } else if (phase === PHASE_PRODUCTION_SERVER) {
    config.distDir = ".next-run";
  } else if (phase === PHASE_DEVELOPMENT_SERVER) {
    config.distDir = ".next";
  }

  return config;
}
