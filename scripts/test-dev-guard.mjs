import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findContainerViolations,
  findDevEnvironmentViolations,
} from "./guard-dev-environment.mjs";

test("accepts the shared Doppler dev profile", () => {
  assert.deepEqual(
    findDevEnvironmentViolations({
      NODE_ENV: "development",
      APP_ENV: "development",
      DOMAIN: "localhost",
      DOPPLER_CONFIG: "dev",
    }),
    [],
  );
});

test("accepts manual runs without Doppler", () => {
  assert.deepEqual(findDevEnvironmentViolations({}), []);
  assert.deepEqual(
    findDevEnvironmentViolations({ DOMAIN: "127.0.0.1", DOPPLER_CONFIG: "" }),
    [],
  );
});

test("accepts a personal dev config", () => {
  assert.deepEqual(
    findDevEnvironmentViolations({ DOPPLER_CONFIG: "dev_personal" }),
    [],
  );
});

test("rejects a production Node environment", () => {
  const violations = findDevEnvironmentViolations({ NODE_ENV: "production" });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /NODE_ENV=production/);
});

test("rejects a production application profile", () => {
  const violations = findDevEnvironmentViolations({ APP_ENV: "production" });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /APP_ENV=production/);
});

test("rejects a public deployment domain", () => {
  const violations = findDevEnvironmentViolations({ DOMAIN: "app.example.com" });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /DOMAIN=app\.example\.com/);
});

test("rejects production and staging Doppler configs", () => {
  for (const config of ["prd", "stg"]) {
    const violations = findDevEnvironmentViolations({ DOPPLER_CONFIG: config });
    assert.equal(violations.length, 1);
    assert.match(violations[0], new RegExp(`DOPPLER_CONFIG=${config}`));
  }
});

test("rejects every leaked production signal at once", () => {
  const violations = findDevEnvironmentViolations({
    NODE_ENV: "production",
    APP_ENV: "production",
    DOMAIN: "app.example.com",
    DOPPLER_CONFIG: "prd",
  });
  assert.equal(violations.length, 4);
});

test("rejects running dev inside the production Docker stack", () => {
  assert.equal(findContainerViolations(false).length, 0);
  const violations = findContainerViolations(true);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /production Docker stack/);
});
