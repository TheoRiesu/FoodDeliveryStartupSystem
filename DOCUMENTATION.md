# Food Delivery Startup System — Full Project Documentation

**Version:** 2.0.0  
**Stack:** Node.js 26 + better-sqlite3 (SQLite, WAL mode) + @opentui/core (TUI)  
**Package Manager:** pnpm 12.3.4 (ESM-only)  
**Entry Point:** `src/index.js`

---

## Table of Contents

1. [Project Layout](#1-project-layout)
2. [Environment & Build Toolchain](#2-environment--build-toolchain)
3. [Core](#3-core)
   - 3.1 Database (`src/core/database.js`)
   - 3.2 Base Entity (`src/core/baseEntity.js`)
   - 3.3 Application Facade (`src/core/app.js`)
4. [Modules](#4-modules)
   - 4.1 Customer Management (`src/modules/customer.js`)
   - 4.2 Menu Management (`src/modules/menu.js`)
   - 4.3 Order Processing (`src/modules/order.js`)
   - 4.4 Payment Processing (`src/modules/payment.js`)
   - 4.5 Delivery Tracking (`src/modules/delivery.js`)
5. [CLI](#5-cli)
   - 5.1 Command-Arg Mode (`src/cli/commands.js`)
   - 5.2 Interactive Mode (`src/cli/interactive.js`)
   - 5.3 Full-Screen TUI (`src/tui/`)
6. [Utilities](#6-utilities)
   - 6.1 CLOG (`src/utils/clog.js`)
   - 6.2 Validator (`src/utils/validator.js`)
   - 6.3 Formatter (`src/utils/formatter.js`)
7. [Communication Flow](#7-communication-flow)
8. [Running the Application](#8-running-the-application)

---

## 1. Project Layout

```
FoodDeliveryStartupSystem/
├── data/                               # SQLite database directory (gitignored)
├── scripts/
│   └── seed-menu.js                    # Sample menu seeder, idempotent (skip existing by name)
├── src/
│   ├── index.js                        # Entry point: init DB, route interactive vs command-arg mode
│   ├── cli/
│   │   ├── commands.js                 # Single-shot command parser, dispatcher, table printers, help text
│   │   └── interactive.js              # Readline menu covering all 6 capabilities
│   ├── core/
│   │   ├── app.js                      # FoodDeliveryApp facade integrating all four team modules
│   │   ├── baseEntity.js               # Abstract BaseEntity (id, createdAt)
│   │   └── database.js                 # SQLite init, 6 tables, indexes (WAL mode, FK on)
│   ├── modules/
│   │   ├── customer.js                 # Module A: Customer + CustomerManager
│   │   ├── menu.js                     # Module B: MenuItem → FoodItem/DrinkItem + MenuManager
│   │   ├── order.js                    # Module C: FoodOrder + OrderItem + OrderManager
│   │   ├── payment.js                  # Module D (1/2): Payment → Cash/Card/EWallet + PaymentProcessor
│   │   └── delivery.js                 # Module D (2/2): Delivery + DeliveryTracker
│   ├── tui/
│   │   ├── app.js                      # TUI shell: renderer lifecycle, layout, dispatch, overlays, toasts, flash ticker
│   │   ├── components/
│   │   │   ├── itemPicker.js             # Multi-item quantity stepper overlay
│   │   │   └── selector.js               # Searchable single-choice modal overlay
│   │   ├── flash.js                    # Change-flash tracker (decaying highlight styles)
│   │   ├── forms.js                    # Generic multi-field form overlay (text/select, inline errors)
│   │   ├── logCapture.js               # stdout capture ring while the TUI owns the screen
│   │   ├── ui.js                       # Renderer-bound helpers: text, tables, key matching, selection
│   │   └── views/
│   │       ├── dashboard.js            # Counts, revenue summary + newest orders
│   │       ├── customers.js            # Customer table + add/edit/remove
│   │       ├── menu.js                 # Menu table + add/toggle/remove
│   │       ├── orders.js               # Order list + detail + create + cancel
│   │       ├── payments.js             # Unpaid orders + pay form + payment history
│   │       ├── deliveries.js           # Delivery list + assign + advance + detail
│   │       ├── transactions.js         # Read-only completed transactions
│   │       ├── logs.js                 # Captured operational log lines
│   │       └── help.js                 # Keybind reference
│   └── utils/
│       ├── clog.js                     # Timestamped colored console logging utility
│       ├── formatter.js                # Currency + TTY-aware table printers
│       ├── theme.js                    # Shared palette, ANSI tokens, shouldUseColor()
│       └── validator.js                # Input validation helpers + <menuId>:<qty> parser
├── .gitignore                          # Git exclusion patterns
├── .prettierignore                     # Prettier exclusion patterns
├── .prettierrc.json                    # Prettier config
├── DOCUMENTATION.md                    # This file
├── eslint.config.js                    # ESLint flat config
├── LICENSE                             # MIT License
├── package.json                        # Project manifest, scripts, dependencies
├── pnpm-lock.yaml                      # Lockfile
├── pnpm-workspace.yaml                 # Pnpm settings: allowBuilds for better-sqlite3
└── README.md                           # User-facing intro and deployment guide
```

Module-to-file rule: every feature lives in its own file. Domain classes live under `src/core/` (shared base + integration) and `src/modules/` (one file per feature); non-domain helpers live under `src/utils/`; user interaction lives under `src/cli/` (readline + commands) and `src/tui/` (full-screen interface).

---

## 2. Environment & Build Toolchain

### Runtime

- **Node.js:** 26 (verified on `v26.8.1`; the full-screen TUI requires >= 26.4 for `@opentui/core` FFI)
- **Package Manager:** pnpm 12.3.4 (pinned via `packageManager` in package.json)
- **Module System:** ESM (`"type": "module"` in package.json)

### Dependencies

| Package          | Version | Purpose                                                                     |
| ---------------- | ------- | --------------------------------------------------------------------------- |
| `better-sqlite3` | ^12.4.1 | Synchronous SQLite3 binding (WAL mode)                                      |
| `@opentui/core`  | 0.5.10  | Full-screen TUI renderer (exact-pinned 0.x; prebuilt binary, TUI path only) |

### Dev Dependencies

| Package    | Purpose               |
| ---------- | --------------------- |
| `eslint`   | Linting (flat config) |
| `globals`  | ESLint globals        |
| `prettier` | Code formatting       |

### Scripts

| Command               | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `pnpm start`          | `node src/index.js` — interactive menu                       |
| `pnpm tui`            | `node --experimental-ffi src/index.js tui` — full-screen TUI |
| `pnpm dev`            | `node --watch src/index.js` — hot-reload dev                 |
| `pnpm seed:menu`      | `node scripts/seed-menu.js` — sample menu seeder             |
| `pnpm lint`           | `prettier --check . && eslint .` — format + lint             |
| `pnpm prettier-write` | `prettier --write .` — auto-format                           |

### Dependency Settings (`pnpm-workspace.yaml`)

- `allowBuilds.better-sqlite3: true` — allows better-sqlite3's native build script (required, otherwise `pnpm run` exits with `ERR_PNPM_IGNORED_BUILDS`)

---

## 3. Core

### 3.1 Database (`src/core/database.js`)

Initializes a **better-sqlite3** connection in **WAL mode** with foreign keys enabled. The database file is `data/data.db`.

#### Initialization Flow

1. `initDatabase()` called from `src/index.js` on startup
2. Ensures `data/` directory exists (`mkdirSync` recursive)
3. Opens database at `data/data.db`
4. Sets `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`
5. Calls `createTables()` — creates 6 tables plus indexes if not exist

#### Tables

| Table         | Primary Key  | Description                                                                                                                                  |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer**  | `id INTEGER` | Customers: name, address, phone, created_at                                                                                                  |
| **MenuItem**  | `id INTEGER` | Menu items: name (UNIQUE), price (CHECK >= 0), category (food/drink), description, is_available, extra (JSON), created_at                    |
| **FoodOrder** | `id INTEGER` | Orders: customer_id (FK), status, total, created_at, updated_at                                                                              |
| **OrderItem** | `id INTEGER` | Order lines: order_id (FK, cascade delete), menu_item_id (FK), item_name snapshot, unit_price snapshot, quantity (CHECK > 0), subtotal       |
| **Payment**   | `id INTEGER` | Payments: order_id (FK, UNIQUE — one payment per order), method, amount, status, reference, created_at                                       |
| **Delivery**  | `id INTEGER` | Deliveries: order_id (FK, UNIQUE — one delivery per order), rider_name, status, picked_up_at, delivered_at, created_at, updated_at           |
| **Indexes**   | —            | `idx_foodorder_customer`, `idx_foodorder_status`, `idx_orderitem_order`, `idx_payment_order`, `idx_delivery_order`, `idx_menuitem_available` |

Prices are snapshotted into `OrderItem` at creation time, so later menu price changes never rewrite history.

#### Helpers

`getDatabase()` — Returns the singleton db instance. Throws if `initDatabase()` was not called first.  
`getDatabasePath()` — Returns the resolved `data/data.db` path (used in logs and docs).

### 3.2 Base Entity (`src/core/baseEntity.js`)

Abstract root of the domain hierarchy. Demonstrates **abstraction**: `new BaseEntity()` throws; concrete classes inherit `id`/`createdAt` handling and `toJSON()` from here.

### 3.3 Application Facade (`src/core/app.js`)

`FoodDeliveryApp` integrates the four team modules into one working system. It owns one manager per module and exposes the cross-module workflows both CLIs call:

| Method                                                                | Modules touched                       | Description                                                                  |
| --------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `registerCustomer(...)`                                               | Customer                              | Delegate to `CustomerManager`                                                |
| `addMenuItem(...)` / `browseMenu(...)`                                | Menu                                  | Delegate to `MenuManager`                                                    |
| `placeOrder(customerId, lines)`                                       | Order (+ Customer, Menu)              | Delegate to `OrderManager`                                                   |
| `payOrder(...)`                                                       | Payment (+ Order)                     | Delegate to `PaymentProcessor`                                               |
| `assignDelivery(...)` / `advanceDelivery(...)` / `trackDelivery(...)` | Delivery (+ Order)                    | Delegate to `DeliveryTracker`                                                |
| `viewTransactions()`                                                  | Order + Customer + Payment + Delivery | Read-only join of delivered orders with customer, payment, and delivery rows |

---

## 4. Modules

### 4.1 Customer Management (`src/modules/customer.js`)

Demonstrates **encapsulation**: `Customer` keeps `#name`, `#address`, `#phone` private behind validated getters/setters (empty-string and phone-format checks).

`CustomerManager` owns all Customer SQL:

| Method                                            | Description                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `addCustomer(name, address, phone)`               | Validates via `Customer`, inserts, returns the created `Customer` |
| `getCustomer(id)`                                 | Returns a `Customer` or `null`                                    |
| `listCustomers()`                                 | All customers ordered by id                                       |
| `updateCustomer(id, { name?, address?, phone? })` | Partial update through validated setters                          |
| `removeCustomer(id)`                              | Refuses when `FoodOrder` rows still reference the customer        |

### 4.2 Menu Management (`src/modules/menu.js`)

Demonstrates **inheritance + polymorphism**: `MenuItem` is the base; `FoodItem` (adds `isSpicy`) and `DrinkItem` (adds `size` S/M/L) override `describe()` and `getFinalPrice()`. Drink pricing: S ×1.0, M ×1.2, L ×1.5.

`MenuManager` owns all MenuItem SQL plus the category-based factory (`buildItem` / `rowToItem` rehydrate the correct subclass from the `category` column; subclass fields round-trip through the `extra` JSON column):

| Method                                                         | Description                                             |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `addMenuItem({ name, price, category, description?, extra? })` | Inserts; duplicate names rejected with a friendly error |
| `getMenuItem(id)`                                              | Returns a `FoodItem`/`DrinkItem` or `null`              |
| `listMenuItems({ availableOnly? })`                            | All items, optionally available-only                    |
| `setAvailability(id, isAvailable)`                             | Toggles `is_available`                                  |
| `removeMenuItem(id)`                                           | Refuses when `OrderItem` rows still reference the item  |

### 4.3 Order Processing (`src/modules/order.js`)

One `FoodOrder` contains **many distinct menu items** via `OrderItem` lines (`menuItemId`, `itemName` snapshot, `unitPrice` snapshot, `quantity`, computed `subtotal`).

A line may carry an optional `size` (drinks only, S/M/L): the variant price comes from the shared `drinkPriceForSize()` helper (same math as `DrinkItem.getFinalPrice()`), the snapshot name records it (`"Cola (L)"`), and duplicates are tracked per variant (one order can hold Cola S and Cola L). Food lines reject `size`; lines without it keep legacy behavior. Drink sizes live in `DRINK_SIZES` (`src/modules/menu.js`).

`getOrderSummary(customerId?)` aggregates `{ count, total, byStatus }` over all (or one customer's) orders — surfaced as `order:summary`, interactive menu `9`, and the TUI dashboard/orders headers.

Order statuses: `pending → paid → preparing → out_for_delivery → delivered`, with `cancelled` reachable from `pending`/`paid`/`preparing`. `canTransitionTo()` enforces the machine; anything else throws.

`OrderManager` owns FoodOrder/OrderItem SQL:

| Method                                 | Description                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createOrder(customerId, lines)`       | Validates customer exists, lines non-empty, no duplicate menu ids, items exist and available; snapshots prices, computes total, inserts order + lines in one transaction |
| `getOrder(id)`                         | Order with its lines, or `null`                                                                                                                                          |
| `listOrders({ customerId?, status? })` | Filtered order listing                                                                                                                                                   |
| `updateStatus(id, next)`               | Guarded transition                                                                                                                                                       |
| `cancelOrder(id)`                      | Shortcut for the `cancelled` transition                                                                                                                                  |

### 4.4 Payment Processing (`src/modules/payment.js`)

Demonstrates **abstraction + polymorphism**: `Payment` is abstract (`new Payment()` throws; `process()` throws). `CashPayment`, `CardPayment` (requires 4-digit `last4`), and `EWalletPayment` (requires `walletId` ≥ 3 chars) each override `process()` with their own rules. `buildPayment()` is the factory.

`PaymentProcessor` owns all Payment SQL:

| Method                                          | Description                                                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pay(orderId, method, details?, reference?)`    | Requires order in `pending` with no existing payment; runs the subclass `process()`, inserts the payment and flips the order to `paid` in one transaction; returns `{ payment, message }` |
| `getPayment(id)` / `getPaymentByOrder(orderId)` | Rehydrate the correct subclass via `buildPayment()`                                                                                                                                       |
| `listPayments()`                                | Raw payment rows ordered by id                                                                                                                                                            |

### 4.5 Delivery Tracking (`src/modules/delivery.js`)

`Delivery` encapsulates its own state machine via `canTransitionTo()`: `assigned → picked_up → on_the_way → delivered`, with `failed` reachable from any non-terminal state.

`DeliveryTracker` owns all Delivery SQL:

| Method                           | Description                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignDelivery(orderId, rider)` | Requires the order to be `paid`/`preparing` and delivery-free; inserts the delivery and moves the order toward `out_for_delivery` in one transaction |
| `updateStatus(orderId, next)`    | Guarded transition; stamps `picked_up_at` / `delivered_at`; delivering the delivery also delivers the order                                          |
| `track(orderId)`                 | Delivery for an order, or `null` when none assigned yet                                                                                              |
| `listDeliveries()`               | Raw delivery rows ordered by id                                                                                                                      |

---

## 5. CLI

### 5.1 Command-Arg Mode (`src/cli/commands.js`)

Single-shot, scriptable commands. `parseArgs()` supports `--key value` and `--key=value`, with repeatable `--item <menuId>:<qty>` collected into an array.

```
customer:add --name <name> --address <addr> --phone <phone>
customer:list
menu:add --name <n> --price <n> --category <food|drink> [--description <t>] [--spicy <true|false>] [--size <S|M|L>]
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
```

Output uses the table printer from `src/utils/formatter.js` with TTY-gated colors from `src/utils/theme.js` (bold headers, green/red availability, yellow pending statuses; byte-identical plain text when piped, under `NO_COLOR`, or on dumb terminals). `HELP_TEXT` is exported so both the command dispatcher and the interactive menu share one source of truth.

### 5.2 Interactive Mode (`src/cli/interactive.js`)

Readline menu launched with no arguments (or `interactive`). Covers all six required capabilities behind numbered options: manage customers, manage menu, browse menu, create multi-item orders, process payments, manage/track deliveries, view completed transactions, plus command-CLI help and an order summary view (option `9`, per-customer or global). Prompts and wording are unchanged; section headers, availability tokens, and status tokens pick up color on capable terminals (plain otherwise). Domain errors are caught per action and reported via `clog` without exiting the loop.

### 5.3 Full-Screen TUI (`src/tui/`)

Opt-in alternate-screen interface (`pnpm tui`, i.e. `node --experimental-ffi src/index.js tui`) built on `@opentui/core` 0.5.10 in direct imperative mode — no JSX, no build step. Requires Node >= 26.4 and an interactive terminal; otherwise it exits with guidance toward `pnpm start`. The TUI module is dynamically imported, so readline and command-arg paths never load the framework.

- **Shell (`app.js`):** renderer lifecycle (`screenMode: "alternate-screen"`, 30fps, no mouse), header/sidebar/main/footer layout, digit navigation (1-9 across Dashboard, Customers, Menu, Orders, Payments, Deliveries, Transactions, Logs, Help), form overlay stack, toast notifications, `q`/`Ctrl+C` quit with terminal restore.
- **Views (`views/`):** thin layers over the same managers — selectable tables, multi-field forms (`forms.js`: Tab/↑↓ move, ←/→ cycle selects, Enter submit, Esc cancel, inline validation errors), `y/n` confirms, order detail expansion, delivery status stepper limited to legal transitions. Dashboard shows order revenue and the orders header shows count + revenue via the shared `getOrderSummary()`.
- **No-memorization pickers (`components/`):** nothing requires a remembered id. `selector.js` is a searchable single-choice modal (type to filter, arrows move, Enter picks, Esc cancels) used for customer and order picking; `itemPicker.js` builds multi-item orders by dialing quantities (`→`/`+` add, `←`/`−` remove, `s` cycles drink sizes S/M/L with live variant pricing) with a live total. In filterable overlays only real arrow keys navigate, so typing `j`/`k`/`h`/`l`/`q` never triggers bindings.
- **Change flashes (`flash.js`):** ticker-style highlights — changed qty/price/total/availability/status cells glow (green up, red down, yellow info) and decay to normal over ~1.2s while a 200ms ticker repaints live marks. Pure decay math (`createFlashTracker`, injectable clock) with `flashCell()` table rendering.
- **Log hygiene (`logCapture.js`):** console output is captured into a 200-line ring buffer while the TUI owns the screen (surfaced in the Logs view) and originals are restored on shutdown — CLI log behavior is untouched.
- **Headless checks:** `createTui(domainApp, factory)` accepts a renderer factory, so the real app code is exercised via `@opentui/core/testing` (`createTestRenderer` + frame capture + mock keys) without a terminal.

---

## 6. Utilities

### 6.1 CLOG (`src/utils/clog.js`)

A colored, timestamped console logging wrapper. Replaces direct `console.log`/`console.warn`/`console.error` calls for operational messages throughout the codebase.

#### Usage

```js
clog(console.log, "message");
clog(console.warn, "warning: %s", detail);
clog(console.error, "error:", err);
```

#### Behavior

- Prepends timestamp: `YYYY-MM-DD HH:mm:ss.SSS [INFO] message`
- Timestamp respects `LOG_TIMEZONE` env var (default UTC), disabled if `LOG_WITH_TIME=false`
- Color coding: INFO=blue, WARN=yellow, ERROR=red (ANSI escape codes)
- All args forwarded to the original console function

### 6.2 Validator (`src/utils/validator.js`)

Pure input-validation helpers with no database access: `requireNonEmptyString`, `requirePositiveNumber`, `requirePositiveInt`, `requirePhone`, `requireCategory` (food/drink), `requirePaymentMethod` (cash/card/ewallet), and `parseItemToken` for `<menuId>:<qty>` CLI tokens. Domain setters and managers call these, so validation lives in one place.

### 6.3 Formatter (`src/utils/formatter.js`)

Pure output helpers with no database access: `formatPrice` (`$X.XX`), `pad`, and `printTable` (plain-text aligned tables with a `(no rows)` empty state).

---

## 7. Communication Flow

### Order Lifecycle Pipeline

```
registerCustomer (Module A)
    ↓
addMenuItem (Module B)
    ↓
placeOrder(customerId, [{ menuItemId, quantity }]) (Module C)
    │ validates customer, availability, duplicates
    │ snapshots item_name + unit_price, computes total
    │ INSERT FoodOrder + OrderItems in one transaction → status "pending"
    ↓
payOrder(orderId, method, details) (Module D — payment)
    │ builds Cash/Card/EWallet subclass → process() validates method details
    │ INSERT Payment + UPDATE FoodOrder → "paid" in one transaction
    ↓
assignDelivery(orderId, rider) (Module D — delivery)
    │ requires "paid"/"preparing" → INSERT Delivery ("assigned")
    │ moves order toward "out_for_delivery"
    ↓
advanceDelivery(orderId, picked_up → on_the_way → delivered)
    │ each step guarded by canTransitionTo()
    │ "delivered" stamps delivered_at and flips order to "delivered"
    ↓
viewTransactions() → JOIN FoodOrder + Customer + Payment + Delivery
    WHERE order delivered AND delivery delivered
```

### CLI Routing

```
node src/index.js
    ↓
initDatabase() → FoodDeliveryApp(db)
    ↓
argv empty or "interactive"?
├── Yes → runInteractive(app) — readline loop, per-action try/catch
└── No  → parseArgs(argv) → runCommand(app, command, options)
            ├── customer:* → CustomerManager
            ├── menu:*     → MenuManager
            ├── order:*    → OrderManager
            ├── payment:*  → PaymentProcessor
            ├── delivery:* → DeliveryTracker
            └── transactions:list → FoodDeliveryApp.viewTransactions()
```

---

## 8. Running the Application

### Prerequisites

- Node.js 26 + pnpm 12.3.4 (repo pins pnpm via `packageManager`)
- No `.env`, Docker, or external services

### Quick Start (Local)

```bash
pnpm install
pnpm seed:menu   # 12 sample items (idempotent, safe to re-run)
pnpm start       # readline menu (default, unchanged behavior)
pnpm tui         # full-screen TUI (needs an interactive terminal, Node >= 26.4)
```

End-to-end demo via single-shot commands:

```bash
node src/index.js customer:add --name "Alice" --address "123 Main St" --phone "+1-555-0100"
node src/index.js menu:add --name "Burger" --price 5.99 --category food
node src/index.js menu:add --name "Cola" --price 1.99 --category drink --size L
node src/index.js order:create --customer 1 --item 1:2 --item 2:1
node src/index.js payment:pay --order 1 --method card --last4 4242
node src/index.js delivery:assign --order 1 --rider "Bob"
node src/index.js delivery:status --order 1 --status picked_up
node src/index.js delivery:status --order 1 --status on_the_way
node src/index.js delivery:status --order 1 --status delivered
node src/index.js transactions:list
```

### Lint

```bash
pnpm lint             # Prettier check + ESLint
pnpm prettier-write   # Auto-format
```

### Shutdown

Graceful shutdown on `SIGINT`/`SIGTERM`: closes the database, exits cleanly.
