// Environment checks shared by next.config.mjs and its unit tests.
//
// The same Next.js build configuration serves two very different runtimes:
// `next dev` for local development and the standalone production server.
// Swapping the profiles would either expose production data to a dev server
// or ship development settings to users, so the mismatch fails fast.

export function findNextEnvironmentViolations(env = process.env) {
  const nodeEnv = (env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (env.APP_ENV || "").trim().toLowerCase();
  const violations = [];

  if (nodeEnv === "production" && appEnv && appEnv !== "production") {
    violations.push(`A production build cannot use APP_ENV=${appEnv}.`);
  }
  if (nodeEnv !== "production" && appEnv === "production") {
    violations.push("The development server cannot use APP_ENV=production.");
  }
  return violations;
}

export function assertNextEnvironment(env = process.env) {
  const violations = findNextEnvironmentViolations(env);
  if (violations.length > 0) {
    throw new Error(violations.join(" "));
  }
}
