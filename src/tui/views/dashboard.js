import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { cell, headerCell } from "../ui.js";

/** Read-only overview: entity counts plus the newest orders. */
export function createDashboardView(ctx) {
  function counts() {
    const customers = ctx.app.customers.listCustomers().length;
    const menu = ctx.app.menu.listMenuItems().length;
    const orders = ctx.app.orders.listOrders();
    const summary = ctx.app.orders.getOrderSummary();
    return { customers, menu, orders, summary };
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const c = counts();
      ui.txt(parent, "Dashboard", { fg: PALETTE.header });
      ui.txt(parent, "");
      ui.txt(
        parent,
        `Customers: ${c.customers}   Menu items: ${c.menu}   Orders: ${c.summary.count} (${formatPrice(c.summary.total)} revenue)   Completed transactions: ${ctx.app.viewTransactions().length}`,
      );
      const statuses = Object.entries(c.summary.byStatus)
        .map(([status, n]) => `${status} ${n}`)
        .join(" · ");
      ui.txt(parent, statuses ? `Orders by status: ${statuses}` : "No orders yet.", {
        fg: PALETTE.muted,
      });
      ui.txt(parent, "");
      ui.txt(parent, "Newest orders:", { fg: PALETTE.header });
      const recent = c.orders.slice(-8).reverse();
      ui.table(parent, [
        [headerCell("id"), headerCell("customer"), headerCell("status"), headerCell("total")],
        ...recent.map((order) => [
          cell(`#${order.id}`),
          cell(`#${order.customerId}`),
          cell(order.status),
          cell(formatPrice(order.total)),
        ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "Press a digit (2-7) to manage an area, or Enter on Customers to begin.", {
        fg: PALETTE.muted,
      });
    },
    onKey() {
      return false;
    },
  };
}
