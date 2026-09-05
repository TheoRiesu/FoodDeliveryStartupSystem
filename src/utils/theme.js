/**
 * Util: shared theme for CLI printers and the full-screen TUI.
 * - CLI (stdout): ANSI codes, gated by shouldUseColor(). Plain text otherwise,
 *   so piped output, NO_COLOR, and dumb terminals are never polluted.
 * - TUI (@opentui/core): hex colors from the same palette roles.
 */

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

export const PALETTE = {
  header: "#7DD3FC",
  accent: "#F0ABFC",
  success: "#4ADE80",
  warning: "#FACC15",
  danger: "#F87171",
  muted: "#94A3B8",
  selectedBg: "#1E3A5F",
  border: "#334155",
};

export function shouldUseColor() {
  return (
    process.stdout.isTTY === true &&
    process.env.NO_COLOR === undefined &&
    process.env.TERM !== "dumb"
  );
}

export function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Wrap text in an ANSI code when color is enabled. Pure pass-through otherwise.
 * @param {string} text
 * @param {keyof typeof ANSI} code
 * @param {boolean} [color]
 */
export function style(text, code, color = shouldUseColor()) {
  if (!color || !ANSI[code]) {
    return String(text);
  }
  return `${ANSI[code]}${text}${ANSI.reset}`;
}

export function header(text, color) {
  return style(text, "bold", color);
}

/** Green "yes" / red "no" availability token. Wording unchanged. */
export function availToken(isAvailable, color) {
  return isAvailable ? style("yes", "green", color) : style("no", "red", color);
}

/** Status token colored by severity. Wording unchanged. */
export function statusToken(status, color) {
  const good = ["delivered", "completed", "paid"];
  const bad = ["failed", "cancelled"];
  if (good.includes(status)) {
    return style(status, "green", color);
  }
  if (bad.includes(status)) {
    return style(status, "red", color);
  }
  return style(status, "yellow", color);
}
