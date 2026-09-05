import { CustomerManager } from "../modules/customer.js";
import { MenuManager } from "../modules/menu.js";
import { OrderManager } from "../modules/order.js";
import { PaymentProcessor } from "../modules/payment.js";
import { DeliveryTracker } from "../modules/delivery.js";

/**
 * Integration facade: wires the four team modules into one working system.
 * - Module A (Customer Management): CustomerManager
 * - Module B (Menu Management): MenuManager
 * - Module C (Order Processing): OrderManager
 * - Module D (Payment and Delivery): PaymentProcessor + DeliveryTracker
 */
export class FoodDeliveryApp {
  #db;
  #customers;
  #menu;
  #orders;
  #payments;
  #deliveries;

  constructor(db) {
    this.#db = db;
    this.#customers = new CustomerManager(db);
    this.#menu = new MenuManager(db);
    this.#orders = new OrderManager(db);
    this.#payments = new PaymentProcessor(db);
    this.#deliveries = new DeliveryTracker(db);
  }

  get customers() {
    return this.#customers;
  }

  get menu() {
    return this.#menu;
  }

  get orders() {
    return this.#orders;
  }

  get payments() {
    return this.#payments;
  }

  get deliveries() {
    return this.#deliveries;
  }

  registerCustomer(name, address, phone) {
    return this.#customers.addCustomer(name, address, phone);
  }

  addMenuItem(args) {
    return this.#menu.addMenuItem(args);
  }

  browseMenu({ availableOnly = true } = {}) {
    return this.#menu.listMenuItems({ availableOnly });
  }

  placeOrder(customerId, lines) {
    return this.#orders.createOrder(customerId, lines);
  }

  payOrder(orderId, method, details = {}, reference = "") {
    return this.#payments.pay(orderId, method, details, reference);
  }

  assignDelivery(orderId, riderName) {
    return this.#deliveries.assignDelivery(orderId, riderName);
  }

  advanceDelivery(orderId, nextStatus) {
    return this.#deliveries.updateStatus(orderId, nextStatus);
  }

  trackDelivery(orderId) {
    return this.#deliveries.track(orderId);
  }

  /**
   * Completed transactions: delivered orders joined with customer,
   * payment, and delivery rows. Read-only reporting query.
   */
  viewTransactions() {
    return this.#db
      .prepare(
        `SELECT
           o.id AS order_id,
           o.total AS total,
           o.created_at AS ordered_at,
           c.name AS customer_name,
           p.method AS pay_method,
           p.amount AS paid_amount,
           d.rider_name AS rider_name,
           d.status AS delivery_status,
           d.delivered_at AS delivered_at
         FROM FoodOrder o
         JOIN Customer c ON c.id = o.customer_id
         JOIN Payment p ON p.order_id = o.id
         JOIN Delivery d ON d.order_id = o.id
         WHERE o.status = 'delivered' AND d.status = 'delivered'
         ORDER BY o.id ASC`,
      )
      .all();
  }
}
