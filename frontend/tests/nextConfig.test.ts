import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config.mjs";

afterEach(() => vi.unstubAllEnvs());

describe("Next.js deployment configuration", () => {
  it("builds a standalone server", () => {
    expect(nextConfig.output).toBe("standalone");
  });

  it("leaves production API routing to Traefik", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await nextConfig.rewrites!()).toEqual([]);
  });

  it("uses the private backend URL for development rewrites", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BACKEND_URL", "http://backend:8000");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://unused.example.com");
    expect(await nextConfig.rewrites!()).toEqual([
      { source: "/api/:path*", destination: "http://backend:8000/api/:path*" },
    ]);
  });

  it("keeps local npm run dev working without Docker", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BACKEND_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    expect(await nextConfig.rewrites!()).toEqual([
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
    ]);
  });
});
