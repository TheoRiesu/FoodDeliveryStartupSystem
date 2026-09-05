import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { cell, headerCell } from "../ui.js";

/** Read-only completed transactions (delivered + paid + delivered). */
export function createTransactionsView(ctx) {
  return {
    render(parent) {
      const { ui } = ctx;
      const rows = ctx.app.viewTransactions();
      ui.txt(parent, `Completed transactions (${rows.length})`, { fg: PALETTE.header });
      ui.table(parent, [
        [
          headerCell("order"),
          headerCell("customer"),
          headerCell("total"),
          headerCell("method"),
          headerCell("rider"),
          headerCell("delivered"),
        ],
        ...rows.map((row) => [
          cell(`#${row.order_id}`),
          cell(row.customer_name),
          cell(formatPrice(row.total)),
          cell(row.pay_method),
          cell(row.rider_name),
          cell(row.delivered_at || "-"),
        ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "Read-only. Complete the order → payment → delivery flow to add rows.", {
        fg: PALETTE.muted,
      });
    },
    onKey() {
      return false;
    },
  };
}
