/**
 * Util: CLI output formatting helpers. Pure functions, no database access.
 * Tables accept pre-styled cell strings (see src/utils/theme.js); widths are
 * measured on visible characters so ANSI codes never misalign columns.
 * With color disabled the output is byte-identical to plain text.
 */
import { header, shouldUseColor, stripAnsi } from "./theme.js";

export function formatPrice(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

export function pad(value, width) {
  const text = String(value ?? "");
  const visible = stripAnsi(text).length;
  if (visible >= width) {
    // Never slice through an escape sequence; drop styling when truncating.
    return (visible === text.length ? text : stripAnsi(text)).slice(0, width);
  }
  return text + " ".repeat(width - visible);
}

/**
 * Render rows as a plain-text table (no external dependencies).
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 * @param {{ color?: boolean }} [opts]
 */
export function printTable(headers, rows, opts = {}) {
  const color = opts.color ?? shouldUseColor();
  const widths = headers.map((h, i) => {
    let max = stripAnsi(String(h)).length;
    for (const row of rows) {
      max = Math.max(max, stripAnsi(String(row[i] ?? "")).length);
    }
    return Math.min(Math.max(max + 2, 6), 32);
  });

  const line = (cells) =>
    cells
      .map((c, i) => pad(c, widths[i]))
      .join("| ")
      .trimEnd();

  console.log(line(headers.map((h) => header(h, color))));
  console.log(widths.map((w) => "-".repeat(w)).join("+-"));
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  for (const row of rows) {
    console.log(line(row));
  }
}
