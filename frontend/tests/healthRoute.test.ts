import { describe, expect, it } from "vitest";
import { GET } from "../src/app/health/route";

describe("GET /health route handler", () => {
  it("returns status 200 with status ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("Ostrovok Travel AI Agent");
  });
});
