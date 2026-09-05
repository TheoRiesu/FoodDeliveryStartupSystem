import { PALETTE } from "../../utils/theme.js";
import { cell, headerCell, isDown, isEnter, isUp, moveSelection } from "../ui.js";

/** Browse customers; a add · e edit · d remove. */
export function createCustomersView(ctx) {
  let selected = 0;

  function rows() {
    return ctx.app.customers.listCustomers();
  }

  function addForm() {
    ctx.openForm({
      title: "Add customer",
      toast: "Customer created.",
      fields: [
        { key: "name", label: "Name", placeholder: "Alice" },
        { key: "address", label: "Address", placeholder: "123 Main St" },
        { key: "phone", label: "Phone", placeholder: "+1-555-0100" },
      ],
      onSubmit: (values) => {
        ctx.app.registerCustomer(values.name, values.address, values.phone);
        return null;
      },
    });
  }

  function editForm(customer) {
    ctx.openForm({
      title: `Edit customer #${customer.id}`,
      toast: "Customer updated.",
      fields: [
        { key: "name", label: "Name", value: customer.name },
        { key: "address", label: "Address", value: customer.address },
        { key: "phone", label: "Phone", value: customer.phone },
      ],
      onSubmit: (values) => {
        ctx.app.customers.updateCustomer(customer.id, values);
        return null;
      },
    });
  }

  return {
    render(parent) {
      const { ui } = ctx;
      const list = rows();
      selected = Math.min(selected, Math.max(list.length - 1, 0));
      ui.txt(parent, "Customers", { fg: PALETTE.header });
      ui.table(parent, [
        [
          headerCell(""),
          headerCell("id"),
          headerCell("name"),
          headerCell("phone"),
          headerCell("address"),
        ],
        ...list.map((c, i) => [
          cell(i === selected ? "▶" : ""),
          cell(`#${c.id}`),
          cell(c.name),
          cell(c.phone),
          cell(c.address),
        ]),
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "↑↓ select · a add · e edit · d remove", { fg: PALETTE.muted });
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
      if (!key.ctrl && !key.meta && key.name === "e") {
        editForm(current);
        return true;
      }
      if (!key.ctrl && !key.meta && key.name === "d") {
        innerCtx.confirm(`Remove customer #${current.id} (${current.name})?`, (confirmCtx) => {
          try {
            confirmCtx.app.customers.removeCustomer(current.id);
            confirmCtx.toast("Customer removed.");
          } catch (err) {
            confirmCtx.toast(err.message, "error");
          }
          confirmCtx.refresh();
        });
        return true;
      }
      if (isEnter(key)) {
        editForm(current);
        return true;
      }
      return false;
    },
  };
}
