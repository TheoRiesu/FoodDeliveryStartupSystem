import { BoxRenderable, TextRenderable, TextTableRenderable, fg } from "@opentui/core";
import { PALETTE } from "../utils/theme.js";

/**
 * Small imperative UI helpers bound to one renderer. Views use these plus
 * manual selected-index state; all keyboard handling flows through the
 * app-level keypress dispatcher (no widget focus model involved).
 */

const ARROW_UP = "\u001B[A";
const ARROW_DOWN = "\u001B[B";
const ARROW_RIGHT = "\u001B[C";
const ARROW_LEFT = "\u001B[D";

export function isUp(key) {
  return key.name === "up" || key.sequence === ARROW_UP || (!key.ctrl && key.name === "k");
}

export function isDown(key) {
  return key.name === "down" || key.sequence === ARROW_DOWN || (!key.ctrl && key.name === "j");
}

/** Arrow keys only (no vim aliases) — for overlays where typing is primary. */
export function isArrowUp(key) {
  return key.name === "up" || key.sequence === ARROW_UP;
}

/** Arrow keys only (no vim aliases) — for overlays where typing is primary. */
export function isArrowDown(key) {
  return key.name === "down" || key.sequence === ARROW_DOWN;
}

export function isLeft(key) {
  return key.name === "left" || key.sequence === ARROW_LEFT || (!key.ctrl && key.name === "h");
}

export function isRight(key) {
  return key.name === "right" || key.sequence === ARROW_RIGHT || (!key.ctrl && key.name === "l");
}

export function isEnter(key) {
  return (
    key.name === "enter" || key.name === "return" || key.sequence === "\r" || key.sequence === "\n"
  );
}

export function isEsc(key) {
  return key.name === "escape" || key.sequence === "\u001B";
}

export function isBackspace(key) {
  return key.name === "backspace" || key.sequence === "\b" || key.sequence === "\x7f";
}

export function isQuit(key) {
  return (key.ctrl && key.name === "c") || (!key.ctrl && !key.meta && key.name === "q");
}

/** Printable single character for manual text fields (ignores combos/sequences). */
export function toPrintableChar(key) {
  if (key.ctrl || key.meta || typeof key.sequence !== "string") {
    return null;
  }
  if (key.sequence.length !== 1 || key.sequence < " " || key.sequence === "\x7f") {
    return null;
  }
  return key.sequence;
}

/** Wrap-around list cursor used by selectable table views. */
export function moveSelection(selected, delta, count) {
  if (count <= 0) {
    return 0;
  }
  return (selected + delta + count) % count;
}

export function createUi(renderer) {
  const txt = (parent, content, opts = {}) => {
    const node = new TextRenderable(renderer, { content, ...opts });
    parent.add(node);
    return node;
  };

  const box = (parent, opts = {}) => {
    const node = new BoxRenderable(renderer, { flexDirection: "column", ...opts });
    parent.add(node);
    return node;
  };

  const clear = (node) => {
    for (const child of node.getChildren()) {
      node.remove(child);
      child.destroy();
    }
  };

  const table = (parent, content, opts = {}) => {
    const node = new TextTableRenderable(renderer, {
      showBorders: true,
      borderStyle: "single",
      borderColor: PALETTE.border,
      wrapMode: "none",
      ...opts,
      content,
    });
    parent.add(node);
    return node;
  };

  return { txt, box, clear, table };
}

/** Hex-styled table cell. Cells are chunk arrays; plain strings stay plain. */
export function cell(text, color) {
  if (!color) {
    return String(text);
  }
  return [fg(color)(String(text))];
}

export function headerCell(text) {
  return [fg(PALETTE.header)(String(text))];
}
