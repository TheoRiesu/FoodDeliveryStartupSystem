import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { FLASH_DOWN, FLASH_INFO, FLASH_UP, flashCell } from "../flash.js";
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
 * Multi-item quantity stepper. Replaces typing "menuId:qty" lines:
 * navigate with ↑↓, dial quantities with →/+/−, cycle drink sizes with
 * "s", confirm with Enter. Drinks expose every size (S/M/L) with live
 * variant pricing; each size variant is its own order line.
 *
 * openItemPicker(ctx, { title, items, onConfirm })
 * items: [{ id, name, price, detail?, variants?: [{ size, price }],
 *           variantIndex?: number }]
 * onConfirm(lines) with lines: [{ menuItemId, quantity, size? }] (qty > 0)
 */
export function openItemPicker(ctx, def) {
  const state = {
    filter: "",
    selected: 0,
    variant: new Map(),
    qty: new Map(),
    error: null,
  };

  function matches() {
    const q = state.filter.toLowerCase();
    const list = q
      ? def.items.filter((item) => `${item.name} ${item.detail || ""}`.toLowerCase().includes(q))
      : def.items.slice();
    state.selected = Math.min(state.selected, Math.max(list.length - 1, 0));
    return list;
  }

  function variantIndexOf(item) {
    if (!item.variants) {
      return -1;
    }
    if (!state.variant.has(item.id)) {
      state.variant.set(item.id, item.variantIndex || 0);
    }
    return state.variant.get(item.id);
  }

  function variantOf(item) {
    const at = variantIndexOf(item);
    return at >= 0 ? item.variants[at] : null;
  }

  function variantKey(item) {
    const variant = variantOf(item);
    return variant ? `${item.id}__${variant.size}` : `${item.id}`;
  }

  function unitPrice(item) {
    const variant = variantOf(item);
    return variant ? variant.price : item.price;
  }

  function displayName(item) {
    const variant = variantOf(item);
    const base = item.detail ? `${item.name} (${item.detail})` : item.name;
    return variant ? `${item.name} [${variant.size}]` : base;
  }

  function qtyOf(item) {
    return state.qty.get(variantKey(item)) || 0;
  }

  function total() {
    let sum = 0;
    for (const item of def.items) {
      if (!item.variants) {
        sum += (state.qty.get(`${item.id}`) || 0) * item.price;
        continue;
      }
      for (const variant of item.variants) {
        sum += (state.qty.get(`${item.id}__${variant.size}`) || 0) * variant.price;
      }
    }
    return sum;
  }

  function lines() {
    const picked = [];
    for (const item of def.items) {
      if (!item.variants) {
        const qty = state.qty.get(`${item.id}`) || 0;
        if (qty > 0) {
          picked.push({ menuItemId: item.id, quantity: qty });
        }
        continue;
      }
      for (const variant of item.variants) {
        const qty = state.qty.get(`${item.id}__${variant.size}`) || 0;
        if (qty > 0) {
          picked.push({ menuItemId: item.id, quantity: qty, size: variant.size });
        }
      }
    }
    return picked;
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
          [headerCell(""), headerCell("item"), headerCell("price"), headerCell("qty")],
          ...list.map((item, i) => {
            const qty = qtyOf(item);
            return [
              cell(i === state.selected ? "▶" : ""),
              cell(displayName(item)),
              flashCell(ctx.flashes, `pick-price:${item.id}`, formatPrice(unitPrice(item))),
              flashCell(
                ctx.flashes,
                `pick-qty:${variantKey(item)}`,
                qty > 0 ? `× ${qty}` : "—",
                qty > 0 ? PALETTE.success : undefined,
              ),
            ];
          }),
        ]);
      }
      ui.txt(root, "");
      const totalStyle = ctx.flashes.styleFor("pick-total", PALETTE.header);
      ui.txt(root, `Total: ${formatPrice(total())}`, { fg: totalStyle.fg });
      if (state.error) {
        ui.txt(root, `Error: ${state.error}`, { fg: PALETTE.danger });
      }
      ui.txt(root, "↑↓ move · →/+ add · ←/− remove · s size (drinks) · Enter done · Esc cancel", {
        fg: PALETTE.muted,
      });
    },
    onKey(key, overlayCtx) {
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
      const current = matches()[state.selected];
      const markTotal = (before) => {
        const after = total();
        if (after !== before) {
          overlayCtx.flash("pick-total", after > before ? FLASH_UP : FLASH_DOWN);
        }
      };
      const bump = (delta) => {
        if (!current) {
          return true;
        }
        const before = total();
        const key = variantKey(current);
        const next = Math.max(qtyOf(current) + delta, 0);
        if (next !== qtyOf(current)) {
          state.qty.set(key, next);
          overlayCtx.flash(`pick-qty:${key}`, delta > 0 ? FLASH_UP : FLASH_DOWN);
          markTotal(before);
        }
        state.error = null;
        return true;
      };
      if (!key.ctrl && !key.meta && (key.sequence === "+" || key.sequence === "=")) {
        return bump(1);
      }
      if (!key.ctrl && !key.meta && key.sequence === "-") {
        return bump(-1);
      }
      // Right/Left arrows double as qty steppers (checked after +/- so
      // printable "+" / "-" never leak into the filter).
      if (key.sequence === "\u001B[C") {
        return bump(1);
      }
      if (key.sequence === "\u001B[D") {
        return bump(-1);
      }
      // Cycle drink sizes; quantities are kept per size variant.
      if (!key.ctrl && !key.meta && key.name === "s" && current && current.variants) {
        const before = total();
        const next = (variantIndexOf(current) + 1) % current.variants.length;
        state.variant.set(current.id, next);
        overlayCtx.flash(`pick-price:${current.id}`, FLASH_INFO);
        markTotal(before);
        state.error = null;
        return true;
      }
      if (isEnter(key)) {
        const picked = lines();
        if (picked.length === 0) {
          state.error = "Set a quantity for at least one item.";
          return true;
        }
        ctx.closeOverlay();
        try {
          def.onConfirm(picked);
        } catch (err) {
          ctx.toast(err.message, "error");
        }
        ctx.refresh();
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
