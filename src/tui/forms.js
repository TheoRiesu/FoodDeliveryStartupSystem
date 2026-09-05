import { PALETTE } from "../utils/theme.js";
import {
  isBackspace,
  isDown,
  isEnter,
  isEsc,
  isLeft,
  isRight,
  isUp,
  toPrintableChar,
} from "./ui.js";

const CURSOR = "▊";

/**
 * Generic full-main form. Fields: { key, label, placeholder?, value?,
 * type: "text" | "select", options?: string[] }.
 * Tab / Up / Down move between fields, Left / Right cycle select options,
 * Enter submits, Esc cancels. Validation errors render inline and keep
 * the form open. onSubmit(values) returns an error string or null.
 */
export function createForm(ui, def) {
  const state = {
    active: 0,
    values: Object.fromEntries(
      def.fields.map((f) => [
        f.key,
        f.value ?? (f.type === "select" ? (f.options?.[0] ?? "") : ""),
      ]),
    ),
    error: null,
  };

  const box = { current: null };

  function renderField(container, field, index) {
    const active = index === state.active;
    const marker = active ? "▶ " : "  ";
    if (field.type === "select") {
      ui.txt(
        container,
        `${marker}${field.label}: < ${state.values[field.key]} >`,
        active ? { fg: PALETTE.header } : {},
      );
      return;
    }
    const shown = state.values[field.key] || field.placeholder || "";
    ui.txt(
      container,
      `${marker}${field.label}: ${shown}${active ? CURSOR : ""}`,
      active ? { fg: PALETTE.header } : {},
    );
  }

  function render(parent) {
    if (box.current) {
      ui.clear(parent);
    }
    const root = ui.box(parent, { padding: 1 });
    box.current = root;
    ui.txt(root, def.title, { fg: PALETTE.header });
    ui.txt(root, "");
    for (let i = 0; i < def.fields.length; i += 1) {
      renderField(root, def.fields[i], i);
    }
    if (state.error) {
      ui.txt(root, "");
      ui.txt(root, `Error: ${state.error}`, { fg: PALETTE.danger });
    }
    ui.txt(root, "");
    ui.txt(root, "Tab/↑↓ move · ←/→ cycle · Enter submit · Esc cancel", { fg: PALETTE.muted });
  }

  function move(delta) {
    state.active = (state.active + delta + def.fields.length) % def.fields.length;
  }

  function onKey(key, ctx) {
    if (isEsc(key)) {
      ctx.closeForm();
      return true;
    }
    if (key.name === "tab") {
      move(key.shift ? -1 : 1);
      ctx.render();
      return true;
    }
    const field = def.fields[state.active];
    if (field.type === "select") {
      // No text entry here, so arrows/aliases are unambiguous.
      if (isLeft(key) || isRight(key)) {
        const options = field.options || [];
        const at = options.indexOf(state.values[field.key]);
        const next = (at + (isRight(key) ? 1 : -1) + options.length) % options.length;
        state.values[field.key] = options[next];
        ctx.render();
        return true;
      }
      if (isUp(key)) {
        move(-1);
        ctx.render();
        return true;
      }
      if (isDown(key)) {
        move(1);
        ctx.render();
        return true;
      }
      if (isEnter(key)) {
        submit(ctx);
        return true;
      }
      return true;
    }
    // Text field: printable characters (including j/k/h/l) append as text.
    // Only non-printable keys navigate or edit.
    const char = toPrintableChar(key);
    if (char) {
      state.values[field.key] += char;
      ctx.render();
      return true;
    }
    if (isUp(key)) {
      move(-1);
      ctx.render();
      return true;
    }
    if (isDown(key)) {
      move(1);
      ctx.render();
      return true;
    }
    if (isEnter(key)) {
      submit(ctx);
      return true;
    }
    if (isBackspace(key)) {
      state.values[field.key] = state.values[field.key].slice(0, -1);
      ctx.render();
      return true;
    }
    return false;
  }

  function submit(ctx) {
    try {
      const error = def.onSubmit({ ...state.values });
      if (typeof error === "string" && error) {
        state.error = error;
        ctx.render();
        return;
      }
      ctx.closeForm();
    } catch (err) {
      state.error = err.message;
      ctx.render();
    }
  }

  return { render, onKey };
}
