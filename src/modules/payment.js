import { BaseEntity } from "../core/baseEntity.js";
import { requirePaymentMethod } from "../utils/validator.js";

export const PAYMENT_METHODS = ["cash", "card", "ewallet"];

/**
 * Module D (part 1) — Payment processing.
 * Demonstrates ABSTRACTION + POLYMORPHISM: Payment is abstract and
 * each method overrides process() with its own validation rules.
 */
export class Payment extends BaseEntity {
  #orderId;
  #method;
  #amount;
  #status;
  #reference;

  constructor({
    id = null,
    orderId,
    method,
    amount,
    status = "completed",
    reference = "",
    createdAt = null,
  }) {
    super(id, createdAt);
    if (new.target === Payment) {
      throw new Error("Payment is abstract. Use CashPayment, CardPayment, or EWalletPayment.");
    }
    this.#orderId = orderId;
    this.#method = requirePaymentMethod(method);
    this.#amount = Number(amount);
    this.#status = status;
    this.#reference = reference ?? "";
  }

  get orderId() {
    return this.#orderId;
  }

  get method() {
    return this.#method;
  }

  get amount() {
    return this.#amount;
  }

  get status() {
    return this.#status;
  }

  get reference() {
    return this.#reference;
  }

  /** @abstract Each payment method validates its own details. */
  process(_details = {}) {
    throw new Error("process() must be implemented by a payment subclass.");
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.#orderId,
      method: this.#method,
      amount: this.#amount,
      status: this.#status,
      reference: this.#reference,
      createdAt: this.createdAt,
    };
  }
}

export class CashPayment extends Payment {
  constructor(args) {
    super({ ...args, method: "cash" });
  }

  process(_details = {}) {
    return { ok: true, message: "Cash will be collected on delivery." };
  }
}

export class CardPayment extends Payment {
  constructor(args) {
    super({ ...args, method: "card" });
  }

  process(details = {}) {
    const last4 = String(details.last4 ?? "");
    if (!/^\d{4}$/.test(last4)) {
      throw new Error('Card payment requires details.last4 as 4 digits (e.g. "4242").');
    }
    return { ok: true, message: `Card ending ${last4} charged.` };
  }
}

export class EWalletPayment extends Payment {
  constructor(args) {
    super({ ...args, method: "ewallet" });
  }

  process(details = {}) {
    const walletId = String(details.walletId ?? "").trim();
    if (walletId.length < 3) {
      throw new Error("E-wallet payment requires details.walletId (min 3 characters).");
    }
    return { ok: true, message: `E-wallet ${walletId} charged.` };
  }
}

export function buildPayment({ orderId, method, amount, reference = "" }) {
  const normalized = requirePaymentMethod(method);
  const args = { orderId, method: normalized, amount, reference };
  if (normalized === "cash") {
    return new CashPayment(args);
  }
  if (normalized === "card") {
    return new CardPayment(args);
  }
  return new EWalletPayment(args);
}

/**
 * Persistence + business rules for payments. Owns all Payment SQL.
 */
export class PaymentProcessor {
  #db;

  constructor(db) {
    this.#db = db;
  }

  pay(orderId, method, details = {}, reference = "") {
    const order = this.#db.prepare("SELECT * FROM FoodOrder WHERE id = ?").get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }
    if (order.status !== "pending") {
      throw new Error(`Order #${orderId} cannot be paid in status "${order.status}".`);
    }
    const existing = this.#db.prepare("SELECT id FROM Payment WHERE order_id = ?").get(orderId);
    if (existing) {
      throw new Error(`Order #${orderId} already has a payment.`);
    }

    const payment = buildPayment({ orderId, method, amount: order.total, reference });
    const result = payment.process(details);

    const insert = this.#db.transaction(() => {
      const info = this.#db
        .prepare(
          "INSERT INTO Payment (order_id, method, amount, status, reference) VALUES (?, ?, ?, 'completed', ?)",
        )
        .run(orderId, payment.method, payment.amount, payment.reference);
      this.#db
        .prepare("UPDATE FoodOrder SET status = 'paid', updated_at = datetime('now') WHERE id = ?")
        .run(orderId);
      return info.lastInsertRowid;
    });

    const paymentId = insert();
    return { payment: this.getPayment(paymentId), message: result.message };
  }

  getPayment(id) {
    const row = this.#db.prepare("SELECT * FROM Payment WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    const payment = buildPayment({
      orderId: row.order_id,
      method: row.method,
      amount: row.amount,
      reference: row.reference,
    });
    payment.id = row.id;
    payment.createdAt = row.created_at;
    return payment;
  }

  getPaymentByOrder(orderId) {
    const row = this.#db.prepare("SELECT * FROM Payment WHERE order_id = ?").get(orderId);
    if (!row) {
      return null;
    }
    const payment = buildPayment({
      orderId: row.order_id,
      method: row.method,
      amount: row.amount,
      reference: row.reference,
    });
    payment.id = row.id;
    payment.createdAt = row.created_at;
    return payment;
  }

  listPayments() {
    return this.#db.prepare("SELECT * FROM Payment ORDER BY id ASC").all();
  }
}
