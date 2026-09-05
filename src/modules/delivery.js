import { BaseEntity } from "../core/baseEntity.js";
import { requireNonEmptyString } from "../utils/validator.js";

export const DELIVERY_STATUSES = ["assigned", "picked_up", "on_the_way", "delivered", "failed"];

const DELIVERY_TRANSITIONS = {
  assigned: ["picked_up", "failed"],
  picked_up: ["on_the_way", "failed"],
  on_the_way: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

/**
 * Module D (part 2) — Delivery tracking.
 * Delivery encapsulates its own state machine via canTransitionTo().
 */
export class Delivery extends BaseEntity {
  #orderId;
  #riderName;
  #status;

  constructor({
    id = null,
    orderId,
    riderName = "",
    status = "assigned",
    createdAt = null,
    updatedAt = null,
  }) {
    super(id, createdAt);
    this.#orderId = orderId;
    this.riderName = riderName;
    this.status = status;
    this.updatedAt = updatedAt;
  }

  get orderId() {
    return this.#orderId;
  }

  get riderName() {
    return this.#riderName;
  }

  set riderName(value) {
    this.#riderName = value === null || value === undefined ? "" : String(value);
  }

  get status() {
    return this.#status;
  }

  set status(value) {
    if (!DELIVERY_STATUSES.includes(value)) {
      throw new Error(
        `Invalid delivery status "${value}". Expected: ${DELIVERY_STATUSES.join(", ")}.`,
      );
    }
    this.#status = value;
  }

  canTransitionTo(next) {
    return (DELIVERY_TRANSITIONS[this.#status] || []).includes(next);
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.#orderId,
      riderName: this.#riderName,
      status: this.#status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Persistence + business rules for deliveries. Owns all Delivery SQL.
 */
export class DeliveryTracker {
  #db;

  constructor(db) {
    this.#db = db;
  }

  assignDelivery(orderId, riderName) {
    const rider = requireNonEmptyString(riderName, "riderName");
    const order = this.#db.prepare("SELECT * FROM FoodOrder WHERE id = ?").get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }
    if (order.status !== "paid" && order.status !== "preparing") {
      throw new Error(
        `Order #${orderId} must be paid before delivery (current: "${order.status}").`,
      );
    }
    const existing = this.#db.prepare("SELECT * FROM Delivery WHERE order_id = ?").get(orderId);
    if (existing) {
      throw new Error(`Order #${orderId} already has a delivery.`);
    }

    const insert = this.#db.transaction(() => {
      const info = this.#db
        .prepare("INSERT INTO Delivery (order_id, rider_name, status) VALUES (?, ?, 'assigned')")
        .run(orderId, rider);
      this.#db
        .prepare(
          "UPDATE FoodOrder SET status = 'preparing', updated_at = datetime('now') WHERE id = ?",
        )
        .run(orderId);
      const preparing = this.#db.prepare("SELECT status FROM FoodOrder WHERE id = ?").get(orderId);
      if (preparing.status === "preparing") {
        this.#db
          .prepare(
            "UPDATE FoodOrder SET status = 'out_for_delivery', updated_at = datetime('now') WHERE id = ?",
          )
          .run(orderId);
      }
      return info.lastInsertRowid;
    });

    insert();
    return this.track(orderId);
  }

  updateStatus(orderId, nextStatus) {
    if (!DELIVERY_STATUSES.includes(nextStatus)) {
      throw new Error(
        `Invalid delivery status "${nextStatus}". Expected: ${DELIVERY_STATUSES.join(", ")}.`,
      );
    }
    const row = this.#db.prepare("SELECT * FROM Delivery WHERE order_id = ?").get(orderId);
    if (!row) {
      throw new Error(`No delivery found for order #${orderId}. Assign one first.`);
    }
    const delivery = new Delivery({
      id: row.id,
      orderId: row.order_id,
      riderName: row.rider_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    if (!delivery.canTransitionTo(nextStatus)) {
      throw new Error(
        `Cannot move delivery for order #${orderId} from "${delivery.status}" to "${nextStatus}".`,
      );
    }

    const update = this.#db.transaction(() => {
      if (nextStatus === "picked_up") {
        this.#db
          .prepare(
            "UPDATE Delivery SET status = ?, picked_up_at = datetime('now'), updated_at = datetime('now') WHERE order_id = ?",
          )
          .run(nextStatus, orderId);
      } else if (nextStatus === "delivered") {
        this.#db
          .prepare(
            "UPDATE Delivery SET status = ?, delivered_at = datetime('now'), updated_at = datetime('now') WHERE order_id = ?",
          )
          .run(nextStatus, orderId);
        this.#db
          .prepare(
            "UPDATE FoodOrder SET status = 'delivered', updated_at = datetime('now') WHERE id = ?",
          )
          .run(orderId);
      } else {
        this.#db
          .prepare(
            "UPDATE Delivery SET status = ?, updated_at = datetime('now') WHERE order_id = ?",
          )
          .run(nextStatus, orderId);
      }
    });

    update();
    return this.track(orderId);
  }

  track(orderId) {
    const row = this.#db.prepare("SELECT * FROM Delivery WHERE order_id = ?").get(orderId);
    if (!row) {
      return null;
    }
    return new Delivery({
      id: row.id,
      orderId: row.order_id,
      riderName: row.rider_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  listDeliveries() {
    return this.#db.prepare("SELECT * FROM Delivery ORDER BY id ASC").all();
  }
}
