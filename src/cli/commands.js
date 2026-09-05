import { formatPrice, printTable } from "../utils/formatter.js";
import { availToken, statusToken, style } from "../utils/theme.js";
import { parseItemToken } from "../utils/validator.js";

export const HELP_TEXT = `
Food Delivery Startup System — CLI

Usage:
  node src/index.js                              Launch interactive menu
  node src/index.js interactive                  Launch interactive menu
  node src/index.js <command> [options]          Run a single command
  node src/index.js tui                        Launch the full-screen TUI (pnpm tui)

Commands:
  customer:add --name <name> --address <addr> --phone <phone>
  customer:list
  menu:add --name <name> --price <n> --category <food|drink> [--description <t>] [--spicy <true|false>] [--size <S|M|L>]
  menu:list [--all]
  menu:set-availability --id <id> --available <true|false>
  order:create --customer <id> --item <menuId:qty> [--item <menuId:qty> ...]
  order:list [--customer <id>] [--status <status>]
  order:summary [--customer <id>]
  order:show --id <id>
  order:cancel --id <id>
  payment:pay --order <id> --method <cash|card|ewallet> [--last4 <dddd>] [--wallet <id>] [--reference <t>]
  delivery:assign --order <id> --rider <name>
  delivery:status --order <id> --status <assigned|picked_up|on_the_way|delivered|failed>
  delivery:track --order <id>
  transactions:list
  help

Examples:
  node src/index.js menu:add --name "Burger" --price 5.99 --category food --spicy false
  node src/index.js order:create --customer 1 --item 1:2 --item 2:1
  node src/index.js payment:pay --order 1 --method card --last4 4242
`.trim();

/**
 * Minimal argv parser. Supports "--key value", "--key=value",
 * repeatable "--item a --item b" (collected into an array),
 * and valueless boolean flags listed in BOOLEAN_FLAGS ("--all").
 */
const BOOLEAN_FLAGS = new Set(["all"]);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  let i = 0;
  while (i < rest.length) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Options must start with --.`);
    }
    const eq = token.indexOf("=");
    let key;
    let value;
    if (eq !== -1) {
      key = token.slice(2, eq);
      value = token.slice(eq + 1);
      i += 1;
    } else {
      key = token.slice(2);
      value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        if (BOOLEAN_FLAGS.has(key)) {
          options[key] = true;
          i += 1;
          continue;
        }
        throw new Error(`Option --${key} requires a value.`);
      }
      i += 2;
    }
    if (key === "item") {
      options.item = [...(options.item || []), value];
    } else {
      options[key] = value;
    }
  }
  return { command: command || "help", options };
}

function printCustomers(customers) {
  printTable(
    ["id", "name", "phone", "address"],
    customers.map((c) => [c.id, c.name, c.phone, c.address]),
  );
}

function printMenu(items) {
  printTable(
    ["id", "name", "cat", "price", "final", "avail", "detail"],
    items.map((item) => {
      const json = item.toJSON();
      const detail =
        item.category === "food"
          ? json.isSpicy
            ? style("spicy", "yellow")
            : "-"
          : style(`size ${json.size}`, "cyan");
      return [
        item.id,
        item.name,
        item.category,
        formatPrice(item.price),
        formatPrice(item.getFinalPrice()),
        availToken(item.isAvailable),
        item.description ? `${item.description} (${detail})` : detail,
      ];
    }),
  );
}

function printOrder(order) {
  console.log(
    `Order #${order.id} — customer #${order.customerId} — ${statusToken(order.status)} — total ${formatPrice(order.total)}`,
  );
  printTable(
    ["menuId", "item", "unit", "qty", "subtotal"],
    order.items.map((line) => [
      line.menuItemId,
      line.itemName,
      formatPrice(line.unitPrice),
      line.quantity,
      formatPrice(line.subtotal),
    ]),
  );
}

export async function runCommand(app, command, options) {
  switch (command) {
    case "customer:add": {
      const created = app.registerCustomer(options.name, options.address, options.phone);
      console.log(`Customer #${created.id} created: ${created.name}`);
      return;
    }
    case "customer:list": {
      printCustomers(app.customers.listCustomers());
      return;
    }
    case "menu:add": {
      const extra = {};
      if (options.spicy !== undefined) {
        extra.isSpicy = options.spicy === "true" || options.spicy === "1";
      }
      if (options.size !== undefined) {
        extra.size = String(options.size).toUpperCase();
      }
      const created = app.addMenuItem({
        name: options.name,
        price: options.price,
        category: options.category,
        description: options.description || "",
        extra,
      });
      console.log(`Menu item #${created.id} created: ${created.describe()}`);
      return;
    }
    case "menu:list": {
      printMenu(app.browseMenu({ availableOnly: options.all === undefined }));
      return;
    }
    case "menu:set-availability": {
      const updated = app.menu.setAvailability(
        Number(options.id),
        options.available === "true" || options.available === "1",
      );
      console.log(`Menu item #${updated.id} availability: ${updated.isAvailable ? "yes" : "no"}`);
      return;
    }
    case "order:create": {
      const lines = (options.item || []).map((token) => parseItemToken(token));
      const order = app.placeOrder(Number(options.customer), lines);
      printOrder(order);
      return;
    }
    case "order:list": {
      const orders = app.orders.listOrders({
        customerId:
          options.customer === null || options.customer === undefined
            ? null
            : Number(options.customer),
        status: options.status ?? null,
      });
      if (orders.length === 0) {
        console.log("(no orders)");
        return;
      }
      for (const order of orders) {
        printOrder(order);
      }
      return;
    }
    case "order:show": {
      const order = app.orders.getOrder(Number(options.id));
      if (!order) {
        throw new Error(`Order #${options.id} not found.`);
      }
      printOrder(order);
      return;
    }
    case "order:cancel": {
      const order = app.orders.cancelOrder(Number(options.id));
      console.log(`Order #${order.id} cancelled.`);
      return;
    }
    case "order:summary": {
      const customerId =
        options.customer === null || options.customer === undefined
          ? null
          : Number(options.customer);
      const summary = app.orders.getOrderSummary(customerId);
      console.log(`Orders: ${summary.count} — total ${formatPrice(summary.total)}`);
      for (const [status, count] of Object.entries(summary.byStatus)) {
        console.log(`  ${status}: ${count}`);
      }
      return;
    }
    case "payment:pay": {
      const details = {};
      if (options.last4) {
        details.last4 = options.last4;
      }
      if (options.wallet) {
        details.walletId = options.wallet;
      }
      const { payment, message } = app.payOrder(
        Number(options.order),
        options.method,
        details,
        options.reference || "",
      );
      console.log(
        `Payment #${payment.id} for order #${payment.orderId}: ${message} (${formatPrice(payment.amount)})`,
      );
      return;
    }
    case "delivery:assign": {
      const delivery = app.assignDelivery(Number(options.order), options.rider);
      console.log(`Delivery for order #${delivery.orderId} assigned to ${delivery.riderName}.`);
      return;
    }
    case "delivery:status": {
      const delivery = app.advanceDelivery(Number(options.order), options.status);
      console.log(`Delivery for order #${delivery.orderId} is now "${delivery.status}".`);
      return;
    }
    case "delivery:track": {
      const delivery = app.trackDelivery(Number(options.order));
      if (!delivery) {
        console.log(`No delivery found for order #${options.order}.`);
        return;
      }
      console.log(
        `Order #${delivery.orderId} — rider: ${delivery.riderName || "-"} — status: ${statusToken(delivery.status)}`,
      );
      return;
    }
    case "transactions:list": {
      const rows = app.viewTransactions();
      printTable(
        ["order", "customer", "total", "method", "rider", "delivered"],
        rows.map((row) => [
          row.order_id,
          row.customer_name,
          formatPrice(row.total),
          row.pay_method,
          row.rider_name,
          row.delivered_at || "-",
        ]),
      );
      return;
    }
    case "help":
    case "--help":
    case "-h": {
      console.log(HELP_TEXT);
      return;
    }
    default: {
      throw new Error(`Unknown command "${command}". Run "help" to list commands.`);
    }
  }
}
