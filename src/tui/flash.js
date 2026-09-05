import { bg, fg } from "@opentui/core";
import { PALETTE } from "../utils/theme.js";

/**
 * Stock-ticker-style change flashes for TUI tables. A view marks a cell
 * key when its value changes; the style decays back to normal over
 * FLASH_DURATION_MS while the app ticker repaints live marks:
 *
 *   phase 1 (bright): solid background highlight, dark text
 *   phase 2 (dim):    colored foreground, no background
 *   expired:          the cell's normal style
 */
export const FLASH_UP = "up";
export const FLASH_DOWN = "down";
export const FLASH_INFO = "info";

export const FLASH_DURATION_MS = 1200;

const PHASE = {
  [FLASH_UP]: { bg: PALETTE.success, fg: "#052e16", soft: PALETTE.success },
  [FLASH_DOWN]: { bg: PALETTE.danger, fg: "#450a0a", soft: PALETTE.danger },
  [FLASH_INFO]: { bg: PALETTE.warning, fg: "#451a03", soft: PALETTE.warning },
};

export function createFlashTracker({ durationMs = FLASH_DURATION_MS, now = Date.now } = {}) {
  const marks = new Map();

  function prune(at) {
    for (const [key, mark] of marks) {
      if (at - mark.at >= durationMs) {
        marks.delete(key);
      }
    }
  }

  return {
    mark(key, kind = FLASH_INFO) {
      marks.set(key, { kind, at: now() });
    },
    active() {
      prune(now());
      return marks.size > 0;
    },
    /**
     * Current style for a cell key. Returns { fg?, bg? }; empty when idle.
     * @param {string} key
     * @param {string} [baseFg] normal foreground once decayed
     */
    styleFor(key, baseFg) {
      const mark = marks.get(key);
      if (!mark) {
        return baseFg ? { fg: baseFg } : {};
      }
      const age = now() - mark.at;
      if (age >= durationMs) {
        marks.delete(key);
        return baseFg ? { fg: baseFg } : {};
      }
      const phase = PHASE[mark.kind] || PHASE[FLASH_INFO];
      if (age < durationMs / 3) {
        return { fg: phase.fg, bg: phase.bg };
      }
      if (age < (durationMs * 2) / 3) {
        return { fg: phase.soft };
      }
      return baseFg ? { fg: baseFg } : {};
    },
  };
}

/**
 * Table cell that flashes on recent change, else renders normally.
 * @param {{ styleFor: Function }} tracker
 */
export function flashCell(tracker, key, text, baseFg) {
  const style = tracker.styleFor(key, baseFg);
  if (!style.fg && !style.bg) {
    return String(text);
  }
  let chunk = fg(style.fg || "#ffffff")(String(text));
  if (style.bg) {
    chunk = bg(style.bg)(chunk);
  }
  return [chunk];
}
