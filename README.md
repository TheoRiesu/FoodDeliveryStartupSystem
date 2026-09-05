![version](https://img.shields.io/badge/version-2.0.0-blue)

# Food Delivery Startup System

A modular food delivery system. Customers can browse menu items, place multi-item orders, process payments, and track deliveries from an interactive readline menu or scriptable single-shot commands.

---

## Deployment

### Prerequisites

- Node.js 26.4+
- pnpm 12

### 1. Local Development

```bash
pnpm install
pnpm seed:menu   # Creates sample menu items in db
pnpm start
```

`pnpm start` launches CLI normally. Direct single actions are supported:

```bash
node src/index.js help
node src/index.js menu:list
node src/index.js order:create --customer 1 --item 1:2 --item 2:1
```

Hot-reload dev:

```bash
pnpm dev
```

Linting (Prettier check + ESLint):

```bash
pnpm lint
pnpm prettier-write
```

---

## Data

All data is stored in `data/data.db` (SQLite, WAL mode).

# License

MIT License — see [LICENSE](./LICENSE) for details.
