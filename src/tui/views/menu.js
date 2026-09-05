import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { FLASH_DOWN, FLASH_UP, flashCell } from "../flash.js";
import { cell, headerCell, isDown, isUp, moveSelection } from "../ui.js";

/** Browse menu; a add · t toggle availability · d remove. */
export function createMenuView(ctx) {
  let selected = 0;

  function rows() {
    return ctx.app.menu.listMenuItems();
  }

  function detail(item) {
    const json = item.toJSON();
    if (item.category === "food") {
      return json.isSpicy ? "spicy" : "-";
    }
    return `size ${json.size}`;
  }

  function addForm() {
    ctx.openForm({
      title: "Add menu item",
      toast: "Menu item created.",
      fields: [
        { key: "name", label: "Name", placeholder: "Burger" },
        { key: "price", label: "Price", placeholder: "5.99" },
        { key: "category", label: "Category", type: "select", options: ["food", "drink"] },
        { key: "description", label: "Description", placeholder: "Optional" },
        { key: "spicy", label: "Spicy (food)", type: "select", options: ["false", "true"] },
        { key: "size", label: "Size (drink)", type: "select", options: ["S", "M", "L"] },
      ],
      onSubmit: (values) => {
        const extra = {};
        if (values.category === "food") {
          extra.isSpicy = values.spicy === "true";
        } else {
          extra.size = values.size;
        }
        ctx.app.addMenuItem({
          name: values.name,
          price: values.price,
          category: values.category,
          description: values.description,
          extra,
        });
        return null;
      },
    });
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const list = rows();
      selected = Math.min(selected, Math.max(list.length - 1, 0));
      ui.txt(parent, "Menu", { fg: PALETTE.header });
      ui.table(parent, [
        [
          headerCell(""),
          headerCell("id"),
          headerCell("name"),
          headerCell("cat"),
          headerCell("price"),
          headerCell("final"),
          headerCell("avail"),
          headerCell("detail"),
        ],
        ...list.map((item, i) => [
          cell(i === selected ? "▶" : ""),
          cell(`#${item.id}`),
          cell(item.name),
          cell(item.category),
          cell(formatPrice(item.price)),
          cell(formatPrice(item.getFinalPrice())),
          flashCell(
            ctx.flashes,
            `menu-avail:${item.id}`,
            item.isAvailable ? "yes" : "no",
            item.isAvailable ? PALETTE.success : PALETTE.danger,
          ),
          cell(detail(item)),
        ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "↑↓ select · a add · t toggle availability · d remove", { fg: PALETTE.muted });
    },
    onKey(key, innerCtx) {
      const list = rows();
      if (isUp(key)) {
        selected = moveSelection(selected, -1, list.length);
        return true;
      }
      if (isDown(key)) {
        selected = moveSelection(selected, 1, list.length);
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "a") {
        addForm();
        return true;
      }
      const current = list[selected];
      if (!current) {
        return false;
      }
      if (!key.ctrl && !key.meta && key.name === "t") {
        const updated = innerCtx.app.menu.setAvailability(current.id, !current.isAvailable);
        innerCtx.flash(`menu-avail:${current.id}`, updated.isAvailable ? FLASH_UP : FLASH_DOWN);
        innerCtx.toast(
          `Item #${updated.id} is now ${updated.isAvailable ? "available" : "unavailable"}.`,
        );
        innerCtx.refresh();
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "d") {
        innerCtx.confirm(`Remove menu item #${current.id} (${current.name})?`, (confirmCtx) => {
          try {
            confirmCtx.app.menu.removeMenuItem(current.id);
            confirmCtx.toast("Menu item removed.");
          } catch (err) {
            confirmCtx.toast(err.message, "error");
          }
          confirmCtx.refresh();
        });
        return true;
      }
      return false;
    },
  };
}
