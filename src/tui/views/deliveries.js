import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { openSelector } from "../components/selector.js";
import { FLASH_DOWN, FLASH_INFO, FLASH_UP, flashCell } from "../flash.js";
import { cell, headerCell, isDown, isEnter, isUp, moveSelection } from "../ui.js";
import { DELIVERY_STATUSES } from "../../modules/delivery.js";

/** Assign riders and advance delivery statuses; Enter shows detail. */
export function createDeliveriesView(ctx) {
  let selected = 0;
  let expandedOrderId = null;

  function rows() {
    return ctx.app.deliveries.listDeliveries();
  }

  function startAssign() {
    const eligible = ctx.app.orders
      .listOrders()
      .filter(
        (order) =>
          (order.status === "paid" || order.status === "preparing") &&
          !ctx.app.deliveries.track(order.id),
      );
    if (eligible.length === 0) {
      ctx.toast("No paid, undelivered orders. Pay an order first (view 5).", "error");
      return;
    }
    openSelector(ctx, {
      title: "Assign delivery — pick an order (type to filter)",
      options: eligible.map((order) => ({
        label: `Order #${order.id}`,
        detail: `customer #${order.customerId} · ${formatPrice(order.total)} · ${order.status}`,
        value: order,
      })),
      onSelect: (order) => riderForm(order),
    });
  }

  function riderForm(order) {
    ctx.openForm({
      title: `Rider for order #${order.id}`,
      toast: "Delivery assigned.",
      fields: [{ key: "rider", label: "Rider name", placeholder: "Bob" }],
      onSubmit: (values) => {
        ctx.app.assignDelivery(order.id, values.rider);
        return null;
      },
    });
  }

  function advanceForm(orderId, from) {
    const allowed = DELIVERY_STATUSES.filter((s) => {
      const row = ctx.app.deliveries.track(orderId);
      return row ? row.canTransitionTo(s) : false;
    });
    if (allowed.length === 0) {
      ctx.toast(`Delivery for order #${orderId} is terminal ("${from}").`, "error");
      return;
    }
    ctx.openForm({
      title: `Advance delivery for order #${orderId} (now "${from}")`,
      toast: "Delivery updated.",
      fields: [{ key: "status", label: "New status", type: "select", options: allowed }],
      onSubmit: (values) => {
        const updated = ctx.app.advanceDelivery(orderId, values.status);
        ctx.flash(
          `del-status:${orderId}`,
          updated.status === "delivered"
            ? FLASH_UP
            : updated.status === "failed"
              ? FLASH_DOWN
              : FLASH_INFO,
        );
        return null;
      },
    });
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const list = rows();
      selected = Math.min(selected, Math.max(list.length - 1, 0));
      ui.txt(parent, "Deliveries", { fg: PALETTE.header });
      ui.table(parent, [
        [headerCell(""), headerCell("order"), headerCell("rider"), headerCell("status")],
        ...list.map((d, i) => [
          cell(i === selected ? "▶" : ""),
          cell(`#${d.order_id}`),
          cell(d.rider_name || "-"),
          flashCell(ctx.flashes, `del-status:${d.order_id}`, d.status),
        ]),
      ]);
      const current = list[selected];
      if (current && expandedOrderId === current.order_id) {
        ui.txt(parent, "");
        ui.txt(
          parent,
          `Order #${current.order_id}: picked up ${current.picked_up_at || "-"} · delivered ${current.delivered_at || "-"}`,
          {
            fg: PALETTE.muted,
          },
        );
      }
      ui.txt(parent, "");
      ui.txt(parent, "↑↓ select · Enter detail · a assign · s advance status", {
        fg: PALETTE.muted,
      });
    },
    onKey(key) {
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
        startAssign();
        return true;
      }
      const current = list[selected];
      if (!current) {
        return false;
      }
      if (isEnter(key)) {
        expandedOrderId = expandedOrderId === current.order_id ? null : current.order_id;
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "s") {
        advanceForm(current.order_id, current.status);
        return true;
      }
      return false;
    },
  };
}
