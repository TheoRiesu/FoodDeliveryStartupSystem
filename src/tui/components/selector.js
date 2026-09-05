import { PALETTE } from "../../utils/theme.js";
import {
  cell,
  headerCell,
  isArrowDown,
  isArrowUp,
  isBackspace,
  isEnter,
  isEsc,
  moveSelection,
  toPrintableChar,
} from "../ui.js";

const CURSOR = "▊";

/**
 * Searchable single-choice modal. Replaces every "type the id" prompt:
 * the user filters by typing and picks with Enter. Esc cancels.
 *
 * openSelector(ctx, { title, options, hint?, onSelect })
 * options: [{ label, detail?, value }]
 */
export function openSelector(ctx, def) {
  const state = { filter: "", selected: 0 };

  function matches() {
    const q = state.filter.toLowerCase();
    const list = q
      ? def.options.filter((o) => `${o.label} ${o.detail || ""}`.toLowerCase().includes(q))
      : def.options.slice();
    state.selected = Math.min(state.selected, Math.max(list.length - 1, 0));
    return list;
  }

  ctx.showOverlay({
    render(parent) {
      const { ui } = ctx;
      const root = ui.box(parent, { padding: 1 });
      ui.txt(root, def.title, { fg: PALETTE.header });
      ui.txt(root, "");
      ui.txt(root, `Filter: ${state.filter}${CURSOR}`, { fg: PALETTE.header });
      const list = matches();
      if (list.length === 0) {
        ui.txt(root, "(no matches — Esc to cancel)", { fg: PALETTE.muted });
      } else {
        ui.table(root, [
          [headerCell(""), headerCell("pick"), headerCell("detail")],
          ...list.map((o, i) => [
            cell(i === state.selected ? "▶" : ""),
            cell(o.label),
            cell(o.detail || ""),
          ]),
        ]);
      }
      ui.txt(root, "");
      ui.txt(root, def.hint || "↑↓ move · type to filter · Enter pick · Esc cancel", {
        fg: PALETTE.muted,
      });
    },
    onKey(key) {
      if (isEsc(key)) {
        ctx.closeOverlay();
        return true;
      }
      if (isBackspace(key)) {
        state.filter = state.filter.slice(0, -1);
        state.selected = 0;
        return true;
      }
      if (isArrowUp(key)) {
        state.selected = moveSelection(state.selected, -1, matches().length);
        return true;
      }
      if (isArrowDown(key)) {
        state.selected = moveSelection(state.selected, 1, matches().length);
        return true;
      }
      if (isEnter(key)) {
        const picked = matches()[state.selected];
        if (picked) {
          ctx.closeOverlay();
          try {
            def.onSelect(picked.value);
          } catch (err) {
            ctx.toast(err.message, "error");
          }
          ctx.refresh();
        }
        return true;
      }
      const char = toPrintableChar(key);
      if (char) {
        state.filter += char;
        state.selected = 0;
        return true;
      }
      return false;
    },
  });
}
