import { getDatabase, initDatabase } from "../src/core/database.js";
import { MenuManager } from "../src/modules/menu.js";
import { clog } from "../src/utils/clog.js";

const LOG_TAG = "[scripts/seed-menu.js]";

/**
 * Sample menu for testing in any environment.
 * `available: false` entries exercise the availability filter
 * (`menu:list` hides them, ordering them is rejected).
 */
const SAMPLE_MENU = [
  {
    name: "Margherita Pizza",
    price: 8.99,
    category: "food",
    description: "Classic tomato, mozzarella, and basil",
  },
  {
    name: "Spicy Ramen",
    price: 9.49,
    category: "food",
    description: "Pork broth, noodles, chili oil",
    extra: { isSpicy: true },
  },
  {
    name: "Cheeseburger",
    price: 6.99,
    category: "food",
    description: "Beef patty, cheddar, lettuce, tomato",
  },
  {
    name: "Chicken Tacos",
    price: 7.49,
    category: "food",
    description: "3 pc, grilled chicken, salsa roja",
    extra: { isSpicy: true },
  },
  {
    name: "Caesar Salad",
    price: 5.99,
    category: "food",
    description: "Romaine, parmesan, croutons",
  },
  {
    name: "Garlic Bread",
    price: 3.49,
    category: "food",
    description: "Toasted baguette, garlic butter",
  },
  { name: "Chocolate Cake", price: 4.29, category: "food", description: "Dark chocolate slice" },
  {
    name: "Seasonal Soup",
    price: 4.99,
    category: "food",
    description: "Rotating seasonal recipe",
    available: false,
  },
  {
    name: "Cola",
    price: 1.99,
    category: "drink",
    description: "Chilled 330ml can",
    extra: { size: "M" },
  },
  {
    name: "Iced Latte",
    price: 3.49,
    category: "drink",
    description: "Espresso with cold milk",
    extra: { size: "L" },
  },
  {
    name: "Green Tea",
    price: 2.29,
    category: "drink",
    description: "Unsweetened hot green tea",
    extra: { size: "S" },
  },
  {
    name: "Mango Smoothie",
    price: 4.49,
    category: "drink",
    description: "Mango, yogurt, honey",
    extra: { size: "L" },
    available: false,
  },
];

initDatabase();
const db = getDatabase();
const menu = new MenuManager(db);
const findByName = db.prepare("SELECT id FROM MenuItem WHERE name = ?");

let inserted = 0;
let skipped = 0;

try {
  for (const entry of SAMPLE_MENU) {
    if (findByName.get(entry.name)) {
      clog(console.log, `${LOG_TAG} Skipped existing item "${entry.name}".`);
      skipped += 1;
      continue;
    }
    const created = menu.addMenuItem(entry);
    if (entry.available === false) {
      menu.setAvailability(created.id, false);
    }
    clog(console.log, `${LOG_TAG} Inserted #${created.id} ${created.describe()}.`);
    inserted += 1;
  }
  clog(console.log, `${LOG_TAG} Done — inserted ${inserted}, skipped ${skipped}.`);
} catch (err) {
  clog(console.error, `${LOG_TAG} ${err.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
