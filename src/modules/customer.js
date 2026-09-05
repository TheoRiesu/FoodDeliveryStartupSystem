import { BaseEntity } from "../core/baseEntity.js";
import { requireNonEmptyString, requirePhone } from "../utils/validator.js";

/**
 * Module A — Customer Management.
 * Demonstrates ENCAPSULATION: fields are private with validated accessors.
 */
export class Customer extends BaseEntity {
  #name;
  #address;
  #phone;

  constructor({ id = null, name, address, phone, createdAt = null }) {
    super(id, createdAt);
    this.name = name;
    this.address = address;
    this.phone = phone;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = requireNonEmptyString(value, "name");
  }

  get address() {
    return this.#address;
  }

  set address(value) {
    this.#address = requireNonEmptyString(value, "address");
  }

  get phone() {
    return this.#phone;
  }

  set phone(value) {
    this.#phone = requirePhone(value);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.#name,
      address: this.#address,
      phone: this.#phone,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Persistence + business rules for customers. Owns all Customer SQL.
 */
export class CustomerManager {
  #db;

  constructor(db) {
    this.#db = db;
  }

  addCustomer(name, address, phone) {
    const customer = new Customer({ name, address, phone });
    const info = this.#db
      .prepare("INSERT INTO Customer (name, address, phone) VALUES (?, ?, ?)")
      .run(customer.name, customer.address, customer.phone);
    return this.getCustomer(info.lastInsertRowid);
  }

  getCustomer(id) {
    const row = this.#db.prepare("SELECT * FROM Customer WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    return CustomerManager.rowToCustomer(row);
  }

  listCustomers() {
    const rows = this.#db.prepare("SELECT * FROM Customer ORDER BY id ASC").all();
    return rows.map((row) => CustomerManager.rowToCustomer(row));
  }

  updateCustomer(id, { name, address, phone }) {
    const existing = this.getCustomer(id);
    if (!existing) {
      throw new Error(`Customer #${id} not found.`);
    }
    const updated = new Customer({
      id: existing.id,
      name: name ?? existing.name,
      address: address ?? existing.address,
      phone: phone ?? existing.phone,
      createdAt: existing.createdAt,
    });
    this.#db
      .prepare("UPDATE Customer SET name = ?, address = ?, phone = ? WHERE id = ?")
      .run(updated.name, updated.address, updated.phone, id);
    return this.getCustomer(id);
  }

  removeCustomer(id) {
    const orders = this.#db
      .prepare("SELECT id FROM FoodOrder WHERE customer_id = ? LIMIT 1")
      .get(id);
    if (orders) {
      throw new Error(`Cannot remove customer #${id}: orders still reference it.`);
    }
    const info = this.#db.prepare("DELETE FROM Customer WHERE id = ?").run(id);
    if (info.changes === 0) {
      throw new Error(`Customer #${id} not found.`);
    }
  }

  static rowToCustomer(row) {
    return new Customer({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      createdAt: row.created_at,
    });
  }
}
