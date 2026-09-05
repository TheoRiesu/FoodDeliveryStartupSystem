import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { clog } from "../utils/clog.js";

const LOG_TAG = "[src/core/database.js]";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const dbPath = path.join(DATA_DIR, "data.db");

/** @type {Database.Database} */
let db;

export function initDatabase() {
  if (db) {
    return db;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables();

  clog(console.log, `${LOG_TAG} Database initialized at ` + dbPath);
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Customer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS MenuItem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL CHECK (price >= 0),
      category TEXT NOT NULL DEFAULT 'food',
      description TEXT DEFAULT '',
      is_available INTEGER NOT NULL DEFAULT 1,
      extra TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS FoodOrder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES Customer(id),
      status TEXT NOT NULL DEFAULT 'pending',
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS OrderItem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES FoodOrder(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES MenuItem(id),
      item_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Payment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES FoodOrder(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      reference TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Delivery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES FoodOrder(id) ON DELETE CASCADE,
      rider_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'assigned',
      picked_up_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_foodorder_customer ON FoodOrder(customer_id);
    CREATE INDEX IF NOT EXISTS idx_foodorder_status ON FoodOrder(status);
    CREATE INDEX IF NOT EXISTS idx_orderitem_order ON OrderItem(order_id);
    CREATE INDEX IF NOT EXISTS idx_payment_order ON Payment(order_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_order ON Delivery(order_id);
    CREATE INDEX IF NOT EXISTS idx_menuitem_available ON MenuItem(is_available);
  `);
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function getDatabasePath() {
  return dbPath;
}
