import util from "node:util";

const MAX_LINES = 200;

/**
 * Captures console output into an in-memory ring buffer while active.
 * The full-screen TUI must never write operational logs to stdout
 * (it would corrupt the alternate screen), so runTui() installs this
 * on startup and restores the originals on shutdown. The Logs view
 * renders the buffered lines. CLI modes never install it.
 */
export function installLogCapture() {
  const lines = [];
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  const push = (level, args) => {
    lines.push({ level, text: util.format(...args), at: new Date() });
    if (lines.length > MAX_LINES) {
      lines.splice(0, lines.length - MAX_LINES);
    }
  };

  console.log = (...args) => push("log", args);
  console.warn = (...args) => push("warn", args);
  console.error = (...args) => push("error", args);

  return {
    lines,
    restore() {
      console.log = originals.log;
      console.warn = originals.warn;
      console.error = originals.error;
    },
  };
}
