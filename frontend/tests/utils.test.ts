import { describe, expect, it } from "vitest";
import { cn, formatPrice } from "@/shared/lib/utils";

describe("cn utility function", () => {
  it("combines class names correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional class names", () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn("base", isTrue && "active", isFalse && "disabled")).toBe("base active");
  });

  it("handles arrays and object inputs", () => {
    expect(
      cn("base", ["array-1", "array-2"], { "obj-active": true, "obj-disabled": false })
    ).toBe("base array-1 array-2 obj-active");
  });

  it("ignores undefined, null, boolean, and empty values", () => {
    expect(cn("base", undefined, null, false, true, "")).toBe("base");
  });

  it("resolves conflicting Tailwind classes using twMerge", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
  });
});

describe("formatPrice utility function", () => {
  it("formats standard positive numbers to Russian Ruble currency format", () => {
    const result = formatPrice(1000);
    // ru-RU locale produces non-breaking space (U+00A0) or narrow non-breaking space (U+202F) between thousands and symbol
    const normalized = result.replace(/\s/g, " ");
    expect(normalized).toBe("1 000 ₽");
  });

  it("formats zero correctly", () => {
    const result = formatPrice(0);
    const normalized = result.replace(/\s/g, " ");
    expect(normalized).toBe("0 ₽");
  });

  it("formats large numbers correctly", () => {
    const result = formatPrice(1234567);
    const normalized = result.replace(/\s/g, " ");
    expect(normalized).toBe("1 234 567 ₽");
  });

  it("rounds floating point numbers to integer according to maximumFractionDigits: 0", () => {
    const result1 = formatPrice(1000.4);
    expect(result1.replace(/\s/g, " ")).toBe("1 000 ₽");

    const result2 = formatPrice(1000.6);
    expect(result2.replace(/\s/g, " ")).toBe("1 001 ₽");
  });

  it("formats negative numbers correctly", () => {
    const result = formatPrice(-500);
    const normalized = result.replace(/\s/g, " ");
    expect(normalized).toBe("-500 ₽");
  });
});
