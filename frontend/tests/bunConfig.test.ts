// @vitest-environment node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(root, path), "utf8");
const rootPackage = JSON.parse(read("package.json"));
const frontendPackage = JSON.parse(read("frontend/package.json"));

describe("Bun migration compatibility", () => {
  it("pins the same Bun version locally and in Docker", () => {
    const version = read(".bun-version").trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rootPackage.packageManager).toBe(`bun@${version}`);
    expect(frontendPackage.packageManager).toBe(`bun@${version}`);
    expect(read("frontend/Dockerfile")).toContain(`FROM oven/bun:${version} AS bun`);
  });

  it("delegates frontend commands using Bun's working-directory syntax", () => {
    for (const [script, target] of Object.entries({
      "dev:front": "dev",
      "test:front": "test",
      build: "build",
      format: "format",
    })) {
      expect(rootPackage.scripts[script]).toBe(`bun run --cwd frontend ${target}`);
    }
    expect(rootPackage.scripts.dev).toContain('"bun run dev:front"');
    expect(rootPackage.scripts.dev).toContain('"bun run dev:back"');
    expect(rootPackage.scripts["dev:static-back"]).toContain("bun run --cwd backend start");
    expect(rootPackage.scripts.lint).toContain("bun run --cwd frontend lint");
    expect(rootPackage.scripts["test:frontend"]).toBe("bun run test:front");
    expect(rootPackage.scripts.test).toBe("bun run test:front && bun run test:back");
  });

  it("installs both JavaScript packages reproducibly without reinstalling Python", () => {
    expect(rootPackage.scripts["setup:front"]).toBe(
      "bun install --frozen-lockfile && bun install --cwd frontend --frozen-lockfile",
    );
    expect(rootPackage.scripts.setup).toBe(
      "bun run setup:front && bun run setup:back",
    );
  });

  it.each([".", "frontend"])("uses only a Bun lockfile in %s", (directory) => {
    expect(existsSync(join(root, directory, "bun.lock"))).toBe(true);
    expect(existsSync(join(root, directory, "package-lock.json"))).toBe(false);
    expect(existsSync(join(root, directory, "bun.lockb"))).toBe(false);
  });

  it("keeps the existing Next.js and Vitest runtimes and commands", () => {
    expect(frontendPackage.scripts.dev).toBe("next dev -p 3000");
    expect(frontendPackage.scripts.build).toBe("next build");
    expect(frontendPackage.scripts.start).toBe("next start -p 3000");
    expect(frontendPackage.scripts.test).toBe("cross-env VITE_CJS_IGNORE_WARNING=true vitest run");
    expect(JSON.stringify(rootPackage.scripts)).not.toContain("--bun");
  });

  it.each([".", "frontend"])(
    "does not preload .env or replace Node.js when running scripts from %s",
    (directory) => {
      const fixture = mkdtempSync(join(tmpdir(), "ostrovok-bun-config-"));
      try {
        copyFileSync(join(root, directory, "bunfig.toml"), join(fixture, "bunfig.toml"));
        writeFileSync(join(fixture, ".env"), "OSTROVOK_ENV_PROBE=must-not-load\n");
        writeFileSync(join(fixture, "package.json"), JSON.stringify({
          private: true,
          scripts: {
            probe: 'node -e "console.log(JSON.stringify({bun: !!process.versions.bun, loaded: process.env.OSTROVOK_ENV_PROBE || null, inherited: process.env.OSTROVOK_INHERITED_PROBE}))"',
          },
        }));
        const env: NodeJS.ProcessEnv = { ...process.env, OSTROVOK_INHERITED_PROBE: "from-shell" };
        delete env.OSTROVOK_ENV_PROBE;
        const output = execFileSync("bun", ["run", "--cwd", fixture, "probe"], {
          cwd: fixture,
          env,
          encoding: "utf8",
          timeout: 15_000,
          stdio: ["ignore", "pipe", "pipe"],
        });
        expect(JSON.parse(output.trim())).toEqual({
          bun: false,
          loaded: null,
          inherited: "from-shell",
        });
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  it("uses Bun for Docker dependencies and builds but keeps the production Node server", () => {
    const dockerfile = read("frontend/Dockerfile");
    expect(dockerfile).toContain("COPY package.json bun.lock bunfig.toml ./");
    expect(dockerfile).toContain("RUN bun install --frozen-lockfile");
    expect(dockerfile).toContain("RUN bun run build");
    expect(dockerfile).toContain("FROM node:22-bookworm-slim AS runner");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).not.toMatch(/npm (ci|install|run)/);
  });
});
