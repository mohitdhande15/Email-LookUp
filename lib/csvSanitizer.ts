/**
 * CSV Sanitization Utility to prevent Formula Injection (CWE-1236 / DDE Injection).
 * Ensures untrusted data exported to CSV cannot execute commands or formulas in
 * spreadsheet software like Microsoft Excel, LibreOffice Calc, or Google Sheets.
 */

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Sanitizes a single cell value for safe inclusion in a CSV file.
 * If the value begins with a formula trigger (even preceded by whitespace),
 * it is prefixed with a single quote (') to force text interpretation.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let str = String(value);

  // Check if trimmed string starts with formula trigger characters
  const trimmed = str.trimStart();
  const startsWithTrigger = FORMULA_TRIGGERS.some((trigger) =>
    trimmed.startsWith(trigger)
  );

  if (startsWithTrigger) {
    // Prepend single quote to neutralize formula execution in Excel/Sheets
    str = `'${str}`;
  }

  // Escape any existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');

  return `"${escaped}"`;
}

/**
 * Builds a complete CSV file string from headers and rows with full formula sanitization.
 */
export function buildSanitizedCsv(
  headers: string[],
  rows: Array<Array<unknown>>
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const rowLines = rows.map((row) =>
    row.map((cell) => sanitizeCsvCell(cell)).join(",")
  );

  return [headerLine, ...rowLines].join("\r\n");
}
