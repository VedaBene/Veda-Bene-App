import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { resolveSentryRelease } from './lib/observability/sentry-release';

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.15.6"],
  agentRules: process.env.SENSITIVE_DATA_SMOKE !== "1",
};

export default function config(phase: string) {
  const release = resolveSentryRelease(process.env, phase === PHASE_PRODUCTION_BUILD && !process.argv.includes('typegen'));
  return withSentryConfig({ ...nextConfig, env: { NEXT_PUBLIC_SENTRY_RELEASE: release ?? '' } }, {
  silent: true,
  release: { name: release, create: false, finalize: false },
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  });
}
