import { formatPrice } from "../../utils/formatter.js";
import { PALETTE } from "../../utils/theme.js";
import { FLASH_INFO, flashCell } from "../flash.js";
import { cell, headerCell, isDown, isUp, moveSelection } from "../ui.js";

/** Pay pending orders; lists recorded payments below. */
export function createPaymentsView(ctx) {
  let selected = 0;

  function pending() {
    return ctx.app.orders.listOrders({ status: "pending" });
  }

  function payForm(order) {
    ctx.openForm({
      title: `Pay order #${order.id} (${formatPrice(order.total)})`,
      toast: "Payment recorded.",
      fields: [
        { key: "method", label: "Method", type: "select", options: ["cash", "card", "ewallet"] },
        { key: "last4", label: "Card last4", placeholder: "4242 (card only)" },
        { key: "wallet", label: "Wallet id", placeholder: "(ewallet only)" },
        { key: "reference", label: "Reference", placeholder: "Optional" },
      ],
      onSubmit: (values) => {
        const details = {};
        if (values.last4.trim()) {
          details.last4 = values.last4.trim();
        }
        if (values.wallet.trim()) {
          details.walletId = values.wallet.trim();
        }
        const { payment } = ctx.app.payOrder(
          order.id,
          values.method,
          details,
          values.reference.trim(),
        );
        ctx.flash(`pay-row:${payment.id}`, FLASH_INFO);
        return null;
      },
    });
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const list = pending();
      selected = Math.min(selected, Math.max(list.length - 1, 0));
      ui.txt(parent, "Awaiting payment", { fg: PALETTE.header });
      ui.table(parent, [
        [headerCell(""), headerCell("order"), headerCell("customer"), headerCell("total")],
        ...list.map((order, i) => [
          cell(i === selected ? "▶" : ""),
          cell(`#${order.id}`),
          cell(`#${order.customerId}`),
          cell(formatPrice(order.total)),
        ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "Recorded payments:", { fg: PALETTE.header });
      ui.table(parent, [
        [headerCell("id"), headerCell("order"), headerCell("method"), headerCell("amount")],
        ...ctx.app.payments
          .listPayments()
          .map((p) => [
            flashCell(ctx.flashes, `pay-row:${p.id}`, `#${p.id}`),
            cell(`#${p.order_id}`),
            cell(p.method),
            cell(formatPrice(p.amount)),
          ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "↑↓ select · p pay selected order", { fg: PALETTE.muted });
    },
    onKey(key) {
      const list = pending();
      if (isUp(key)) {
        selected = moveSelection(selected, -1, list.length);
        return true;
      }
      if (isDown(key)) {
        selected = moveSelection(selected, 1, list.length);
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "p" && list[selected]) {
        payForm(list[selected]);
        return true;
      }
      return false;
    },
  };
}
