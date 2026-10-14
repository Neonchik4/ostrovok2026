import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * WCAG 2.1 Specification Relative Luminance & Contrast Ratio calculation.
 * Standard: https://www.w3.org/TR/WCAG21/#contrast-minimum
 */
function parseHsl(hslStr: string): [number, number, number] {
  const parts = hslStr.trim().split(/\s+/);
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace("%", ""));
  const l = parseFloat(parts[2].replace("%", ""));
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTokensFromCss(cssContent: string): Record<string, [number, number, number]> {
  const tokens: Record<string, [number, number, number]> = {};
  const tokenRegex = /--([a-z0-9-]+):\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/g;
  let match;
  while ((match = tokenRegex.exec(cssContent)) !== null) {
    const name = match[1];
    const h = parseFloat(match[2]);
    const s = parseFloat(match[3]);
    const l = parseFloat(match[4]);
    tokens[name] = [h, s, l];
  }
  return tokens;
}

function getLuminance(tokens: Record<string, [number, number, number]>, tokenName: string): number {
  const hsl = tokens[tokenName];
  if (!hsl) {
    throw new Error(`Token --${tokenName} not found in parsed CSS variables`);
  }
  const [r, g, b] = hslToRgb(hsl[0], hsl[1], hsl[2]);
  return relativeLuminance(r, g, b);
}

describe("WCAG 2.1 AA Palette Contrast Tests", () => {
  const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css");
  const cssContent = fs.readFileSync(globalsCssPath, "utf-8");
  const tokens = parseTokensFromCss(cssContent);

  const lum = (token: string) => getLuminance(tokens, token);
  const contrast = (t1: string, t2: string) => calculateContrastRatio(lum(t1), lum(t2));

  describe("Layer 1: Text on Base Page Surface (--background)", () => {
    it("foreground text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("foreground", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("primary interactive text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("primary", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("muted-foreground secondary text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("muted-foreground", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("destructive text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("destructive", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("warning text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("warning", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("success text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("success", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("alert text has contrast >= 4.5:1 on background (WCAG AA)", () => {
      const ratio = contrast("alert", "background");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Layer 2: Text on Card Surfaces (--card)", () => {
    it("card-foreground has contrast >= 4.5:1 on card", () => {
      const ratio = contrast("card-foreground", "card");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("muted-foreground has contrast >= 4.5:1 on card", () => {
      const ratio = contrast("muted-foreground", "card");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("primary badges and links have contrast >= 4.5:1 on card", () => {
      const ratio = contrast("primary", "card");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("warning status text has contrast >= 4.5:1 on card", () => {
      const ratio = contrast("warning", "card");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Layer 3: Text on Nested Surfaces and Chips", () => {
    it("foreground text on muted surface has contrast >= 4.5:1", () => {
      const ratio = contrast("foreground", "muted");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("muted-foreground text on muted surface has contrast >= 4.5:1", () => {
      const ratio = contrast("muted-foreground", "muted");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("primary-foreground on primary button has contrast >= 4.5:1", () => {
      const ratio = contrast("primary-foreground", "primary");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("secondary-foreground on secondary badge has contrast >= 4.5:1", () => {
      const ratio = contrast("secondary-foreground", "secondary");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("destructive-foreground on destructive button has contrast >= 4.5:1", () => {
      const ratio = contrast("destructive-foreground", "destructive");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("warning text on warning-bg chip has contrast >= 4.5:1", () => {
      const ratio = contrast("warning", "warning-bg");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("success text on success-bg chip has contrast >= 4.5:1", () => {
      const ratio = contrast("success", "success-bg");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("alert text on alert-bg chip has contrast >= 4.5:1", () => {
      const ratio = contrast("alert", "alert-bg");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Layer 4: UI Components and Focus Indicators (WCAG >= 3:1)", () => {
    it("ring focus outline has contrast >= 3.0:1 on background", () => {
      const ratio = contrast("ring", "background");
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it("primary icons have contrast >= 3.0:1 on card", () => {
      const ratio = contrast("primary", "card");
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("Layer 5: Static Analysis Guard against Low-Contrast Classes in UI code", () => {
    const srcDir = path.resolve(__dirname, "../src");

    function getAllFiles(dir: string, fileList: string[] = []): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          getAllFiles(fullPath, fileList);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const allSourceFiles = getAllFiles(srcDir);

    it("disallows low-contrast yellow/amber text classes across all components", () => {
      const forbiddenPattern = /\btext-(amber|yellow)-(100|200|300|400)\b/g;
      const violations: string[] = [];

      for (const file of allSourceFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const matches = content.match(forbiddenPattern);
        if (matches) {
          violations.push(`${path.relative(srcDir, file)}: ${matches.join(", ")}`);
        }
      }

      expect(violations).toEqual([]);
    });

    it("disallows opacity on muted-foreground text that degrades contrast below AA", () => {
      const forbiddenOpacityPattern = /\btext-muted-foreground\/(30|40|50|60|70|80)\b/g;
      const violations: string[] = [];

      for (const file of allSourceFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const matches = content.match(forbiddenOpacityPattern);
        if (matches) {
          violations.push(`${path.relative(srcDir, file)}: ${matches.join(", ")}`);
        }
      }

      expect(violations).toEqual([]);
    });

    it("disallows hardcoded dark-mode bg-black containers inside light surfaces", () => {
      // Exclude standard dialog overlay/backdrop classes
      const forbiddenBlackContentPattern = /className="[^"]*\bbg-black\/(40|50)[^"]*"/g;
      const violations: string[] = [];

      for (const file of allSourceFiles) {
        if (file.includes("dialog.tsx") || file.includes("HotelDetailModal.tsx")) continue;
        const content = fs.readFileSync(file, "utf-8");
        const matches = content.match(forbiddenBlackContentPattern);
        if (matches) {
          violations.push(`${path.relative(srcDir, file)}: ${matches.join(", ")}`);
        }
      }

      expect(violations).toEqual([]);
    });

    it("ensures StudioPage does not contain slop badges", () => {
      const studioPagePath = path.resolve(__dirname, "../src/app/studio/page.tsx");
      const content = fs.readFileSync(studioPagePath, "utf-8");

      expect(content).not.toContain("Доступ команды активен");
      expect(content).not.toContain("Требуется токен");
    });

    it("ensures layout.tsx body does not lock page scrolling with overflow-hidden", () => {
      const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      expect(content).not.toMatch(/<body[^>]*\boverflow-hidden\b/);
    });
  });

  describe("Layer 6: Negative Validation (Rejection of Illegible Yellow / Gray on White)", () => {
    it("mathematically rejects amber-200 on white (< 2:1 contrast)", () => {
      const [r, g, b] = hslToRgb(48, 96, 77);
      const amberLum = relativeLuminance(r, g, b);
      const whiteLum = 1.0;
      const ratio = calculateContrastRatio(amberLum, whiteLum);
      expect(ratio).toBeLessThan(2.0);
    });

    it("mathematically rejects amber-400 on white (< 2:1 contrast)", () => {
      const [r, g, b] = hslToRgb(43, 96, 56);
      const amberLum = relativeLuminance(r, g, b);
      const whiteLum = 1.0;
      const ratio = calculateContrastRatio(amberLum, whiteLum);
      expect(ratio).toBeLessThan(2.0);
    });

    it("mathematically rejects yellow-300 on white (< 2:1 contrast)", () => {
      const [r, g, b] = hslToRgb(50, 98, 64);
      const yellowLum = relativeLuminance(r, g, b);
      const whiteLum = 1.0;
      const ratio = calculateContrastRatio(yellowLum, whiteLum);
      expect(ratio).toBeLessThan(2.0);
    });
  });
});
