#!/usr/bin/env node
// Refuses to start the local development stack when production settings leak in.
//
// The repository ships a single production Docker stack (docker-compose.yml);
// development always runs on the host with the Doppler `dev` config. Every
// developer entry point therefore runs this guard first, so dev tooling can
// never pick up a production profile, domain or Doppler config.

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LOCAL_DOMAINS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
export const DEV_DOPPLER_CONFIGS = new Set(["", "dev", "dev_personal"]);

export function findDevEnvironmentViolations(env) {
  const violations = [];
  const nodeEnv = (env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (env.APP_ENV || "").trim().toLowerCase();
  const domain = (env.DOMAIN || "").trim().toLowerCase();
  const dopplerConfig = (env.DOPPLER_CONFIG || "").trim().toLowerCase();

  if (nodeEnv === "production") {
    violations.push("NODE_ENV=production runs production tooling, not the dev stack.");
  }
  if (appEnv && appEnv !== "development") {
    violations.push(`APP_ENV=${appEnv} is not a development profile.`);
  }
  if (domain && !LOCAL_DOMAINS.has(domain)) {
    violations.push(`DOMAIN=${domain} is not a local hostname.`);
  }
  if (!DEV_DOPPLER_CONFIGS.has(dopplerConfig)) {
    violations.push(`DOPPLER_CONFIG=${dopplerConfig} is not the shared dev config.`);
  }
  return violations;
}

export function findContainerViolations(inContainer = existsSync("/.dockerenv")) {
  return inContainer
    ? ["The repository only ships a production Docker stack; run dev on the host."]
    : [];
}

function main() {
  const violations = [
    ...findDevEnvironmentViolations(process.env),
    ...findContainerViolations(),
  ];
  if (violations.length > 0) {
    console.error("Refusing to start the development stack:");
    for (const violation of violations) console.error(`- ${violation}`);
    console.error("Use `bun run dev:dop` to load the shared Doppler dev secrets.");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
