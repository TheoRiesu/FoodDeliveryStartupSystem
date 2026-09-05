import { BaseEntity } from "../core/baseEntity.js";
import { requirePositiveInt } from "../utils/validator.js";
import { MenuManager } from "./menu.js";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const ORDER_TRANSITIONS = {
  pending: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * Module C — Order Processing.
 * One FoodOrder holds MANY distinct menu items via OrderItem lines.
 */
export class OrderItem {
  menuItemId;
  itemName;
  unitPrice;
  quantity;

  constructor({ menuItemId, itemName, unitPrice, quantity }) {
    this.menuItemId = requirePositiveInt(menuItemId, "menuItemId");
    this.itemName = itemName;
    this.unitPrice = unitPrice;
    this.quantity = requirePositiveInt(quantity, "quantity");
  }

  get subtotal() {
    return Number((this.unitPrice * this.quantity).toFixed(2));
  }

  toJSON() {
    return {
      menuItemId: this.menuItemId,
      itemName: this.itemName,
      unitPrice: this.unitPrice,
      quantity: this.quantity,
      subtotal: this.subtotal,
    };
  }
}

export class FoodOrder extends BaseEntity {
  #customerId;
  #status;
  #total;
  #items;

  constructor({
    id = null,
    customerId,
    status = "pending",
    total = 0,
    items = [],
    createdAt = null,
    updatedAt = null,
  }) {
    super(id, createdAt);
    this.#customerId = requirePositiveInt(customerId, "customerId");
    this.status = status;
    this.#total = Number(total) || 0;
    this.#items = items;
    this.updatedAt = updatedAt;
  }

  get customerId() {
    return this.#customerId;
  }

  get status() {
    return this.#status;
  }

  set status(value) {
    if (!ORDER_STATUSES.includes(value)) {
      throw new Error(`Invalid order status "${value}". Expected: ${ORDER_STATUSES.join(", ")}.`);
    }
    this.#status = value;
  }

  get total() {
    return this.#total;
  }

  get items() {
    return [...this.#items];
  }

  canTransitionTo(next) {
    return (ORDER_TRANSITIONS[this.#status] || []).includes(next);
  }

  toJSON() {
    return {
      id: this.id,
      customerId: this.#customerId,
      status: this.#status,
      total: this.#total,
      items: this.#items.map((item) => item.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Persistence + business rules for orders. Owns FoodOrder/OrderItem SQL.
 */
export class OrderManager {
  #db;

  constructor(db) {
    this.#db = db;
  }

  /**
   * Create one order with multiple distinct menu items.
   * @param {number} customerId
   * @param {Array<{menuItemId:number, quantity:number}>} lines
   */
  createOrder(customerId, lines) {
    const customer = this.#db.prepare("SELECT id FROM Customer WHERE id = ?").get(customerId);
    if (!customer) {
      throw new Error(`Customer #${customerId} not found.`);
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error("An order must contain at least one menu item.");
    }

    const menu = new MenuManager(this.#db);
    const seen = new Set();
    const orderItems = lines.map((line) => {
      const menuItemId = requirePositiveInt(line.menuItemId, "menuItemId");
      const quantity = requirePositiveInt(line.quantity, "quantity");
      if (seen.has(menuItemId)) {
        throw new Error(
          `Duplicate menu item #${menuItemId} in one order. Merge quantities instead.`,
        );
      }
      seen.add(menuItemId);
      const item = menu.getMenuItem(menuItemId);
      if (!item) {
        throw new Error(`Menu item #${menuItemId} not found.`);
      }
      if (!item.isAvailable) {
        throw new Error(`Menu item "${item.name}" is currently unavailable.`);
      }
      return new OrderItem({
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: item.getFinalPrice(),
        quantity,
      });
    });

    const total = Number(orderItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

    const insert = this.#db.transaction(() => {
      const orderInfo = this.#db
        .prepare("INSERT INTO FoodOrder (customer_id, status, total) VALUES (?, 'pending', ?)")
        .run(customerId, total);
      const orderId = orderInfo.lastInsertRowid;
      const insertLine = this.#db.prepare(
        "INSERT INTO OrderItem (order_id, menu_item_id, item_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const item of orderItems) {
        insertLine.run(
          orderId,
          item.menuItemId,
          item.itemName,
          item.unitPrice,
          item.quantity,
          item.subtotal,
        );
      }
      return orderId;
    });

    return this.getOrder(insert());
  }

  getOrder(id) {
    const row = this.#db.prepare("SELECT * FROM FoodOrder WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    const lines = this.#db
      .prepare("SELECT * FROM OrderItem WHERE order_id = ? ORDER BY id ASC")
      .all(id);
    return new FoodOrder({
      id: row.id,
      customerId: row.customer_id,
      status: row.status,
      total: row.total,
      items: lines.map(
        (line) =>
          new OrderItem({
            menuItemId: line.menu_item_id,
            itemName: line.item_name,
            unitPrice: line.unit_price,
            quantity: line.quantity,
          }),
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  listOrders({ customerId = null, status = null } = {}) {
    let sql = "SELECT * FROM FoodOrder";
    const clauses = [];
    const params = [];
    if (customerId !== null && customerId !== undefined) {
      clauses.push("customer_id = ?");
      params.push(customerId);
    }
    if (status !== null && status !== undefined) {
      clauses.push("status = ?");
      params.push(status);
    }
    if (clauses.length > 0) {
      sql += " WHERE " + clauses.join(" AND ");
    }
    sql += " ORDER BY id ASC";
    const rows = this.#db.prepare(sql).all(...params);
    return rows.map((row) => this.getOrder(row.id));
  }

  getOrderSummary(customerId = null) {
    const orders = this.listOrders(
      customerId === null || customerId === undefined ? {} : { customerId },
    );
    const byStatus = {};
    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
    }
    const total = Number(orders.reduce((sum, order) => sum + order.total, 0).toFixed(2));
    return { count: orders.length, total, byStatus };
  }

  updateStatus(id, nextStatus) {
    const order = this.getOrder(id);
    if (!order) {
      throw new Error(`Order #${id} not found.`);
    }
    if (!order.canTransitionTo(nextStatus)) {
      throw new Error(`Cannot move order #${id} from "${order.status}" to "${nextStatus}".`);
    }
    this.#db
      .prepare("UPDATE FoodOrder SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextStatus, id);
    return this.getOrder(id);
  }

  cancelOrder(id) {
    return this.updateStatus(id, "cancelled");
  }
}
