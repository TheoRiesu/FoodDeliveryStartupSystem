import { formatPrice } from "../../utils/formatter.js";
import { DRINK_SIZES, drinkPriceForSize } from "../../modules/menu.js";
import { PALETTE } from "../../utils/theme.js";
import { openItemPicker } from "../components/itemPicker.js";
import { openSelector } from "../components/selector.js";
import { cell, headerCell, isDown, isEnter, isUp, moveSelection } from "../ui.js";

/** Browse orders; a starts the no-IDs wizard · Enter detail · x cancel. */
export function createOrdersView(ctx) {
  let selected = 0;
  let expandedId = null;

  function rows() {
    return ctx.app.orders.listOrders();
  }

  function startCreate() {
    const customers = ctx.app.customers.listCustomers();
    if (customers.length === 0) {
      ctx.toast("Add a customer first (view 2).", "error");
      return;
    }
    openSelector(ctx, {
      title: "Create order — pick a customer (type to filter)",
      options: customers.map((c) => ({
        label: c.name,
        detail: `#${c.id} · ${c.phone}`,
        value: c,
      })),
      onSelect: (customer) => pickItems(customer),
    });
  }

  function pickItems(customer) {
    const items = ctx.app.menu.listMenuItems({ availableOnly: true });
    if (items.length === 0) {
      ctx.toast("No available menu items (view 3).", "error");
      return;
    }
    openItemPicker(ctx, {
      title: `Order for ${customer.name} — set quantities (s cycles drink size)`,
      items: items.map((item) => {
        const json = item.toJSON();
        if (item.category === "drink") {
          return {
            id: item.id,
            name: item.name,
            price: item.getFinalPrice(),
            variants: DRINK_SIZES.map((size) => ({
              size,
              price: drinkPriceForSize(item.price, size),
            })),
            variantIndex: Math.max(DRINK_SIZES.indexOf(json.size), 0),
          };
        }
        return {
          id: item.id,
          name: item.name,
          price: item.getFinalPrice(),
          detail: json.isSpicy ? "spicy" : "",
        };
      }),
      onConfirm: (lines) => {
        const order = ctx.app.placeOrder(customer.id, lines);
        ctx.toast(`Order #${order.id} created — ${formatPrice(order.total)}.`);
      },
    });
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const list = rows();
      selected = Math.min(selected, Math.max(list.length - 1, 0));
      const summary = ctx.app.orders.getOrderSummary();
      ui.txt(parent, `Orders (${summary.count} · ${formatPrice(summary.total)} revenue)`, {
        fg: PALETTE.header,
      });
      ui.table(parent, [
        [
          headerCell(""),
          headerCell("id"),
          headerCell("customer"),
          headerCell("status"),
          headerCell("total"),
        ],
        ...list.map((order, i) => [
          cell(i === selected ? "▶" : ""),
          cell(`#${order.id}`),
          cell(`#${order.customerId}`),
          cell(order.status),
          cell(formatPrice(order.total)),
        ]),
      ]);
      const current = list[selected];
      if (current && expandedId === current.id) {
        const full = ctx.app.orders.getOrder(current.id);
        ui.txt(parent, "");
        ui.txt(parent, `Order #${full.id} lines:`, { fg: PALETTE.header });
        ui.table(parent, [
          [headerCell("item"), headerCell("unit"), headerCell("qty"), headerCell("subtotal")],
          ...full.items.map((line) => [
            cell(line.itemName),
            cell(formatPrice(line.unitPrice)),
            cell(String(line.quantity)),
            cell(formatPrice(line.subtotal)),
          ]),
        ]);
      }
      ui.txt(parent, "");
      ui.txt(parent, "↑↓ select · Enter detail · a new order (guided) · x cancel", {
        fg: PALETTE.muted,
      });
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
        startCreate();
        return true;
      }
      const current = list[selected];
      if (!current) {
        return false;
      }
      if (isEnter(key)) {
        expandedId = expandedId === current.id ? null : current.id;
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "x") {
        innerCtx.confirm(`Cancel order #${current.id}?`, (confirmCtx) => {
          try {
            confirmCtx.app.orders.cancelOrder(current.id);
            confirmCtx.toast(`Order #${current.id} cancelled.`);
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
