import { BaseEntity } from "../core/baseEntity.js";
import {
  requireCategory,
  requireNonEmptyString,
  requirePositiveNumber,
} from "../utils/validator.js";

/**
 * Module B — Menu Management.
 * Demonstrates INHERITANCE + POLYMORPHISM:
 * MenuItem is the base; FoodItem and DrinkItem override describe()
 * and getFinalPrice().
 */
export class MenuItem extends BaseEntity {
  #name;
  #price;
  #category;
  #description;
  #isAvailable;

  constructor({
    id = null,
    name,
    price,
    category,
    description = "",
    isAvailable = true,
    createdAt = null,
  }) {
    super(id, createdAt);
    this.name = name;
    this.price = price;
    this.category = category;
    this.description = description ?? "";
    this.isAvailable = isAvailable;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = requireNonEmptyString(value, "name");
  }

  get price() {
    return this.#price;
  }

  set price(value) {
    this.#price = requirePositiveNumber(value, "price");
  }

  get category() {
    return this.#category;
  }

  set category(value) {
    this.#category = requireCategory(value);
  }

  get description() {
    return this.#description;
  }

  set description(value) {
    this.#description = value === null || value === undefined ? "" : String(value);
  }

  get isAvailable() {
    return this.#isAvailable;
  }

  set isAvailable(value) {
    this.#isAvailable = value === true || value === 1 || value === "1";
  }

  /** Polymorphic hook: subclasses adjust the effective selling price. */
  getFinalPrice() {
    return this.#price;
  }

  /** Polymorphic hook: subclasses extend the human-readable summary. */
  describe() {
    return `${this.#name} (${this.#category}) — $${this.getFinalPrice().toFixed(2)}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.#name,
      price: this.#price,
      category: this.#category,
      description: this.#description,
      isAvailable: this.#isAvailable,
      finalPrice: this.getFinalPrice(),
      createdAt: this.createdAt,
    };
  }
}

export class FoodItem extends MenuItem {
  #isSpicy;

  constructor(args) {
    super({ ...args, category: "food" });
    this.isSpicy = args.extra?.isSpicy ?? args.isSpicy ?? false;
  }

  get isSpicy() {
    return this.#isSpicy;
  }

  set isSpicy(value) {
    this.#isSpicy = value === true;
  }

  describe() {
    return `${super.describe()}${this.#isSpicy ? " [spicy]" : ""}`;
  }

  toJSON() {
    return { ...super.toJSON(), isSpicy: this.#isSpicy };
  }
}

const DRINK_SIZE_MULTIPLIER = { S: 1.0, M: 1.2, L: 1.5 };

export const DRINK_SIZES = Object.keys(DRINK_SIZE_MULTIPLIER);

export function isDrinkSize(value) {
  return Object.hasOwn(DRINK_SIZE_MULTIPLIER, String(value || "").toUpperCase());
}

/** Size-variant price shared by DrinkItem and order line snapshots. */
export function drinkPriceForSize(basePrice, size) {
  const normalized = String(size || "").toUpperCase();
  if (!isDrinkSize(normalized)) {
    throw new Error("Drink size must be one of: S, M, L.");
  }
  return Number((Number(basePrice) * DRINK_SIZE_MULTIPLIER[normalized]).toFixed(2));
}

export class DrinkItem extends MenuItem {
  #size;

  constructor(args) {
    super({ ...args, category: "drink" });
    this.size = args.extra?.size ?? args.size ?? "M";
  }

  get size() {
    return this.#size;
  }

  set size(value) {
    const size = String(value || "M").toUpperCase();
    if (!isDrinkSize(size)) {
      throw new Error("Drink size must be one of: S, M, L.");
    }
    this.#size = size;
  }

  getFinalPrice() {
    return drinkPriceForSize(this.price, this.#size);
  }

  describe() {
    return `${super.describe()} [size ${this.#size}]`;
  }

  toJSON() {
    return { ...super.toJSON(), size: this.#size };
  }
}

/**
 * Persistence + business rules for menu items. Owns all MenuItem SQL.
 */
export class MenuManager {
  #db;

  constructor(db) {
    this.#db = db;
  }

  addMenuItem({ name, price, category, description = "", extra = {} }) {
    const item = MenuManager.buildItem({ name, price, category, description, extra });
    try {
      const info = this.#db
        .prepare(
          "INSERT INTO MenuItem (name, price, category, description, is_available, extra) VALUES (?, ?, ?, ?, 1, ?)",
        )
        .run(item.name, item.price, item.category, item.description, JSON.stringify(extra ?? {}));
      return this.getMenuItem(info.lastInsertRowid);
    } catch (err) {
      if (String(err.message).includes("UNIQUE constraint failed")) {
        throw new Error(`Menu item "${name}" already exists.`);
      }
      throw err;
    }
  }

  getMenuItem(id) {
    const row = this.#db.prepare("SELECT * FROM MenuItem WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    return MenuManager.rowToItem(row);
  }

  listMenuItems({ availableOnly = false } = {}) {
    const rows = availableOnly
      ? this.#db.prepare("SELECT * FROM MenuItem WHERE is_available = 1 ORDER BY id ASC").all()
      : this.#db.prepare("SELECT * FROM MenuItem ORDER BY id ASC").all();
    return rows.map((row) => MenuManager.rowToItem(row));
  }

  setAvailability(id, isAvailable) {
    const item = this.getMenuItem(id);
    if (!item) {
      throw new Error(`Menu item #${id} not found.`);
    }
    this.#db
      .prepare("UPDATE MenuItem SET is_available = ? WHERE id = ?")
      .run(isAvailable ? 1 : 0, id);
    return this.getMenuItem(id);
  }

  removeMenuItem(id) {
    const used = this.#db
      .prepare("SELECT id FROM OrderItem WHERE menu_item_id = ? LIMIT 1")
      .get(id);
    if (used) {
      throw new Error(`Cannot remove menu item #${id}: it is used by existing orders.`);
    }
    const info = this.#db.prepare("DELETE FROM MenuItem WHERE id = ?").run(id);
    if (info.changes === 0) {
      throw new Error(`Menu item #${id} not found.`);
    }
  }

  static buildItem({
    id = null,
    name,
    price,
    category,
    description = "",
    extra = {},
    createdAt = null,
    isAvailable = true,
  }) {
    const normalized = requireCategory(category);
    if (normalized === "food") {
      return new FoodItem({
        id,
        name,
        price,
        category,
        description,
        extra,
        createdAt,
        isAvailable,
      });
    }
    return new DrinkItem({ id, name, price, category, description, extra, createdAt, isAvailable });
  }

  static rowToItem(row) {
    let extra = {};
    try {
      extra = JSON.parse(row.extra || "{}");
    } catch {
      extra = {};
    }
    return MenuManager.buildItem({
      id: row.id,
      name: row.name,
      price: row.price,
      category: row.category,
      description: row.description,
      extra,
      createdAt: row.created_at,
      isAvailable: row.is_available === 1,
    });
  }
}
