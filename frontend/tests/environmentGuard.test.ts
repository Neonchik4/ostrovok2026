import { describe, expect, it } from "vitest";
import {
  assertNextEnvironment,
  findNextEnvironmentViolations,
} from "../environment-guard.mjs";

describe("Next.js environment guard", () => {
  it("allows the development server with the dev profile", () => {
    expect(
      findNextEnvironmentViolations({
        NODE_ENV: "development",
        APP_ENV: "development",
      }),
    ).toEqual([]);
  });

  it("allows a production build with the production profile", () => {
    expect(
      findNextEnvironmentViolations({
        NODE_ENV: "production",
        APP_ENV: "production",
      }),
    ).toEqual([]);
  });

  it("allows legacy runs without an explicit APP_ENV", () => {
    expect(findNextEnvironmentViolations({})).toEqual([]);
    expect(findNextEnvironmentViolations({ NODE_ENV: "production" })).toEqual([]);
    expect(findNextEnvironmentViolations({ NODE_ENV: "development" })).toEqual([]);
  });

  it("rejects a production build carrying the dev profile", () => {
    const violations = findNextEnvironmentViolations({
      NODE_ENV: "production",
      APP_ENV: "development",
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/APP_ENV=development/);
  });

  it("rejects a dev server carrying the production profile", () => {
    const violations = findNextEnvironmentViolations({
      NODE_ENV: "development",
      APP_ENV: "production",
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/APP_ENV=production/);
  });

  it("throws through the assertion helper", () => {
    expect(() =>
      assertNextEnvironment({ NODE_ENV: "development", APP_ENV: "production" }),
    ).toThrow(/APP_ENV=production/);
    expect(() =>
      assertNextEnvironment({ NODE_ENV: "development", APP_ENV: "development" }),
    ).not.toThrow();
  });
});
