// Configuration-only checks: no Docker daemon, builds, secrets or ACME requests.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dockerEnv = {
  ...process.env,
  DOMAIN: "deployment.example.com",
  ACME_EMAIL: "admin@example.com",
  GEMINI_API_KEYS: "test-placeholder",
  GEMINI_API_KEY: "",
};
const config = JSON.parse(execFileSync("docker", [
  "compose", "--env-file", ".env.example", "-f", "docker-compose.yml",
  "config", "--format", "json",
], { cwd: root, env: dockerEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

const { services } = config;

test("only Traefik publishes ports", () => {
  assert.deepEqual(Object.keys(services).sort(), ["backend", "frontend", "traefik"]);
  assert.deepEqual(services.traefik.ports.map((p) => p.published).sort(), ["443", "80"]);
  assert.equal(services.backend.ports, undefined);
  assert.equal(services.frontend.ports, undefined);
});

test("API routing preserves the prefix and does not match /apix", () => {
  const labels = services.backend.labels;
  assert.equal(labels["traefik.http.routers.ostrovok-api.rule"],
    "Host(`deployment.example.com`) && (Path(`/api`) || PathPrefix(`/api/`))");
  assert.equal(labels["traefik.http.services.ostrovok-api.loadbalancer.server.port"], "8000");
  assert.equal(services.frontend.labels["traefik.http.services.ostrovok-web.loadbalancer.server.port"], "3000");
  const text = JSON.stringify(config).toLowerCase();
  assert.ok(!text.includes("buffering"));
  assert.ok(!text.includes("stripprefix"));
});

test("certificates persist and no insecure dashboard is enabled", () => {
  assert.ok(services.traefik.volumes.some((v) => v.target === "/letsencrypt/acme.json" && !v.read_only));
  assert.ok(services.traefik.command.includes("--providers.docker.exposedbydefault=false"));
  assert.ok(services.traefik.command.includes("--certificatesresolvers.letsencrypt.acme.tlschallenge=true"));
  assert.ok(!services.traefik.command.includes("--api.insecure=true"));
});

test("backend runs a single worker without embedding datasets or secrets", () => {
  const dockerfile = read("backend/Dockerfile");
  assert.match(dockerfile, /FROM python:3\.11-slim/);
  const cmd = JSON.parse(dockerfile.match(/^CMD (.+)$/m)[1]);
  assert.equal(cmd[cmd.indexOf("--workers") + 1], "1");
  assert.equal(cmd[cmd.indexOf("--host") + 1], "0.0.0.0");
  assert.equal(cmd[cmd.indexOf("--port") + 1], "8000");
  assert.ok(!cmd.includes("--reload"));
  assert.doesNotMatch(dockerfile, /^COPY .*outputs|^COPY .*\.env/m);
  assert.equal(services.backend.build.context.replaceAll("\\", "/").split("/").pop(), "backend");
  const volumes = services.backend.volumes;
  assert.ok(volumes.some((v) => v.target === "/app/outputs" && v.read_only));
  for (const name of ["chroma_db_v2", "chroma_db_gemini"]) {
    assert.ok(volumes.some((v) => v.target === `/app/outputs/${name}` && !v.read_only));
  }
  assert.ok(services.backend.healthcheck);
  assert.ok(services.frontend.healthcheck);
});

test("frontend uses standalone output and receives no Gemini keys", () => {
  assert.match(read("frontend/Dockerfile"), /\.next\/standalone/);
  assert.match(read("frontend/Dockerfile"), /AS builder/);
  assert.equal(services.frontend.environment.BACKEND_URL, "http://backend:8000");
  assert.equal(services.frontend.environment.GEMINI_API_KEYS, undefined);
  assert.equal(services.frontend.env_file, undefined);
  assert.ok(!read("frontend/Dockerfile").includes("NEXT_PUBLIC_BACKEND_URL"));
});

test("build contexts exclude secrets, local dependencies and caches", () => {
  for (const dir of ["backend", "frontend"]) {
    const ignore = read(`${dir}/.dockerignore`);
    for (const entry of ["**/.git", "**/node_modules", "**/.venv", "**/.next", "**/.env", "**/__pycache__"]) {
      assert.ok(ignore.split("\n").includes(entry), `${dir} must exclude ${entry}`);
    }
  }
});
