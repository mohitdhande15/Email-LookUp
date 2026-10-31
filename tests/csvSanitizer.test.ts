import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, buildSanitizedCsv } from "@/lib/csvSanitizer";

describe("CSV Sanitizer (Formula Injection Prevention)", () => {
  it("neutralizes formula trigger characters (=, +, -, @, \\t, \\r)", () => {
    expect(sanitizeCsvCell("=cmd|' /C calc'!A0")).toBe(`"'=cmd|' /C calc'!A0"`);
    expect(sanitizeCsvCell("+1+2")).toBe(`"'+1+2"`);
    expect(sanitizeCsvCell("-5")).toBe(`"'-5"`);
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe(`"'@SUM(A1:A10)"`);
    expect(sanitizeCsvCell("\t=1+1")).toBe(`"'\t=1+1"`);
  });

  it("handles leading whitespace before formula trigger characters", () => {
    expect(sanitizeCsvCell("   =1+1")).toBe(`"'   =1+1"`);
    expect(sanitizeCsvCell("  @danger")).toBe(`"'  @danger"`);
  });

  it("escapes quotes properly by doubling them", () => {
    expect(sanitizeCsvCell('Hello "World"')).toBe(`"Hello ""World"""`);
    expect(sanitizeCsvCell('="malicious"')).toBe(`"'=""malicious"""`);
  });

  it("passes safe numbers and booleans as unquoted or safe representations", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(0)).toBe("0");
    expect(sanitizeCsvCell(true)).toBe("true");
    expect(sanitizeCsvCell(false)).toBe("false");
  });

  it("handles null and undefined gracefully", () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });

  it("builds a full sanitized CSV correctly", () => {
    const headers = ["Service", "Formula Payload", "Count"];
    const rows = [
      ["Google", "Normal data", 10],
      ["Malicious Service", "=2+2", 5],
    ];

    const result = buildSanitizedCsv(headers, rows);
    const lines = result.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(`"Service","Formula Payload","Count"`); // header "Count" is 5 chars? wait: header is string so "Count"
    expect(lines[2]).toBe(`"Malicious Service","'=2+2",5`);
  });
});
