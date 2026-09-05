import readline from "node:readline";
import { clog } from "../utils/clog.js";
import { formatPrice } from "../utils/formatter.js";
import { availToken, header, statusToken } from "../utils/theme.js";
import { HELP_TEXT } from "./commands.js";

const LOG_TAG = "[src/cli/interactive.js]";

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

async function pause(rl) {
  await ask(rl, "\nPress Enter to continue...");
}

function showMainMenu() {
  console.log(header("\n=== Food Delivery Startup System ==="));
  console.log("1. Manage customers");
  console.log("2. Manage menu items");
  console.log("3. Browse menu");
  console.log("4. Create food order (multiple distinct items per order)");
  console.log("5. Process payment");
  console.log("6. Manage / track delivery");
  console.log("7. View completed transactions");
  console.log("8. Show command-CLI help");
  console.log("0. Exit");
}

async function manageCustomers(rl, app) {
  console.log(header("\n-- Customers --"));
  console.log("a. List customers");
  console.log("b. Add customer");
  const choice = await ask(rl, "Choice (a/b): ");
  if (choice === "a") {
    for (const c of app.customers.listCustomers()) {
      console.log(`#${c.id} ${c.name} — ${c.phone} — ${c.address}`);
    }
  } else if (choice === "b") {
    const name = await ask(rl, "Name: ");
    const address = await ask(rl, "Address: ");
    const phone = await ask(rl, "Phone: ");
    const created = app.registerCustomer(name, address, phone);
    console.log(`Created customer #${created.id}.`);
  } else {
    console.log("Cancelled.");
  }
}

async function manageMenu(rl, app) {
  console.log(header("\n-- Menu --"));
  console.log("a. List menu (all)");
  console.log("b. Add menu item");
  console.log("c. Set availability");
  const choice = await ask(rl, "Choice (a/b/c): ");
  if (choice === "a") {
    for (const item of app.menu.listMenuItems()) {
      console.log(`#${item.id} ${item.describe()} — avail: ${availToken(item.isAvailable)}`);
    }
  } else if (choice === "b") {
    const name = await ask(rl, "Name: ");
    const price = await ask(rl, "Price: ");
    const category = await ask(rl, "Category (food/drink): ");
    const description = await ask(rl, "Description (optional): ");
    const extra = {};
    if (category.toLowerCase() === "food") {
      extra.isSpicy = (await ask(rl, "Spicy? (y/n): ")).toLowerCase() === "y";
    } else {
      extra.size = (await ask(rl, "Size (S/M/L, default M): ")) || "M";
    }
    const created = app.addMenuItem({ name, price, category, description, extra });
    console.log(`Created: ${created.describe()}`);
  } else if (choice === "c") {
    const id = await ask(rl, "Menu id: ");
    const available = await ask(rl, "Available? (y/n): ");
    const updated = app.menu.setAvailability(Number(id), available.toLowerCase() === "y");
    console.log(`#${updated.id} availability: ${availToken(updated.isAvailable)}`);
  } else {
    console.log("Cancelled.");
  }
}

async function createOrderFlow(rl, app) {
  const customerId = Number(await ask(rl, "Customer id: "));
  console.log('Add items as "<menuId>:<qty>" (empty line to finish):');
  const lines = [];
  for (;;) {
    const token = await ask(rl, `Item ${lines.length + 1}: `);
    if (!token) {
      break;
    }
    const [menuId, qty] = token.split(":");
    lines.push({ menuItemId: Number(menuId), quantity: Number(qty) });
  }
  const order = app.placeOrder(customerId, lines);
  console.log(`Order #${order.id} created — total ${formatPrice(order.total)}.`);
}

async function payFlow(rl, app) {
  const orderId = Number(await ask(rl, "Order id: "));
  const method = await ask(rl, "Method (cash/card/ewallet): ");
  const details = {};
  if (method === "card") {
    details.last4 = await ask(rl, "Card last4 (4 digits): ");
  }
  if (method === "ewallet") {
    details.walletId = await ask(rl, "Wallet id: ");
  }
  const reference = await ask(rl, "Reference (optional): ");
  const { payment, message } = app.payOrder(orderId, method, details, reference);
  console.log(`Paid ${formatPrice(payment.amount)} — ${message}`);
}

async function deliveryFlow(rl, app) {
  console.log("\na. Assign delivery");
  console.log("b. Advance delivery status");
  console.log("c. Track delivery");
  const choice = await ask(rl, "Choice (a/b/c): ");
  if (choice === "a") {
    const orderId = Number(await ask(rl, "Order id: "));
    const rider = await ask(rl, "Rider name: ");
    const delivery = app.assignDelivery(orderId, rider);
    console.log(`Assigned ${delivery.riderName} to order #${delivery.orderId}.`);
  } else if (choice === "b") {
    const orderId = Number(await ask(rl, "Order id: "));
    const status = await ask(rl, "New status (picked_up/on_the_way/delivered/failed): ");
    const delivery = app.advanceDelivery(orderId, status);
    console.log(`Delivery is now "${statusToken(delivery.status)}".`);
  } else if (choice === "c") {
    const orderId = Number(await ask(rl, "Order id: "));
    const delivery = app.trackDelivery(orderId);
    console.log(
      delivery
        ? `Rider: ${delivery.riderName} — status: ${statusToken(delivery.status)}`
        : "No delivery yet.",
    );
  } else {
    console.log("Cancelled.");
  }
}

export async function runInteractive(app) {
  const rl = createInterface();
  try {
    for (;;) {
      showMainMenu();
      const choice = await ask(rl, "\nSelect: ");
      try {
        if (choice === "0") {
          console.log("Goodbye.");
          return;
        } else if (choice === "1") {
          await manageCustomers(rl, app);
        } else if (choice === "2") {
          await manageMenu(rl, app);
        } else if (choice === "3") {
          for (const item of app.browseMenu({ availableOnly: true })) {
            console.log(`#${item.id} ${item.describe()}`);
          }
        } else if (choice === "4") {
          await createOrderFlow(rl, app);
        } else if (choice === "5") {
          await payFlow(rl, app);
        } else if (choice === "6") {
          await deliveryFlow(rl, app);
        } else if (choice === "7") {
          const rows = app.viewTransactions();
          if (rows.length === 0) {
            console.log("(no completed transactions yet)");
          }
          for (const row of rows) {
            console.log(
              `Order #${row.order_id} — ${row.customer_name} — ${formatPrice(row.total)} via ${row.pay_method} — rider ${row.rider_name}`,
            );
          }
        } else if (choice === "8") {
          console.log(`\n${HELP_TEXT}`);
        } else {
          console.log("Unknown option.");
          continue;
        }
      } catch (err) {
        clog(console.error, `${LOG_TAG} ${err.message}`);
      }
      await pause(rl);
    }
  } finally {
    rl.close();
  }
}
