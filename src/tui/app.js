import { PALETTE } from "../utils/theme.js";
import { createFlashTracker } from "./flash.js";
import { createUi, isEsc, isQuit } from "./ui.js";
import { createForm } from "./forms.js";
import { installLogCapture } from "./logCapture.js";
import { createDashboardView } from "./views/dashboard.js";
import { createCustomersView } from "./views/customers.js";
import { createMenuView } from "./views/menu.js";
import { createOrdersView } from "./views/orders.js";
import { createPaymentsView } from "./views/payments.js";
import { createDeliveriesView } from "./views/deliveries.js";
import { createTransactionsView } from "./views/transactions.js";
import { createLogsView } from "./views/logs.js";
import { createHelpView } from "./views/help.js";

const VIEW_DEFS = [
  { id: "dashboard", digit: "1", title: "Dashboard", create: createDashboardView },
  { id: "customers", digit: "2", title: "Customers", create: createCustomersView },
  { id: "menu", digit: "3", title: "Menu", create: createMenuView },
  { id: "orders", digit: "4", title: "Orders", create: createOrdersView },
  { id: "payments", digit: "5", title: "Payments", create: createPaymentsView },
  { id: "deliveries", digit: "6", title: "Deliveries", create: createDeliveriesView },
  { id: "transactions", digit: "7", title: "Transactions", create: createTransactionsView },
  { id: "logs", digit: "8", title: "Logs", create: createLogsView },
  { id: "help", digit: "9", title: "Help", create: createHelpView },
];

/**
 * Full-screen TUI shell. Owns the renderer lifecycle, layout (header /
 * sidebar / main / footer), keyboard dispatch, form overlay stack, and
 * toast notifications. Domain logic stays in the managers; views are thin.
 *
 * @param {import("../core/app.js").FoodDeliveryApp} domainApp
 * @param {(opts: object) => Promise<any>} newRenderer renderer factory
 *   (createCliRenderer in production, createTestRenderer in headless checks)
 */
export async function createTui(domainApp, newRenderer) {
  const core = await import("@opentui/core");
  const renderer = await newRenderer({
    exitOnCtrlC: false,
    useMouse: false,
    targetFps: 30,
    screenMode: "alternate-screen",
  });

  const capture = installLogCapture();
  const ui = createUi(renderer);
  const flashes = createFlashTracker();
  const views = new Map();

  const state = {
    viewId: "dashboard",
    overlay: null,
    toastMsg: null,
    toastKind: "info",
    toastTimer: null,
    destroyed: false,
    quitResolve: null,
  };
  const quitPromise = new Promise((resolve) => {
    state.quitResolve = resolve;
  });

  function view(id) {
    if (!views.has(id)) {
      const def = VIEW_DEFS.find((v) => v.id === id);
      views.set(id, { def, instance: def.create(ctx) });
    }
    return views.get(id);
  }

  function paint() {
    if (state.destroyed) {
      return;
    }
    ui.clear(mainBox);
    if (state.overlay) {
      state.overlay.render(mainBox);
    } else {
      view(state.viewId).instance.render(mainBox);
    }
    paintSidebar();
    paintFooter();
    renderer.requestRender();
  }

  function paintSidebar() {
    ui.clear(sidebarBox);
    for (const def of VIEW_DEFS) {
      const active = def.id === state.viewId && !state.overlay;
      ui.txt(
        sidebarBox,
        `${active ? "▶ " : "  "}${def.digit}. ${def.title}`,
        active ? { fg: PALETTE.header } : {},
      );
    }
  }

  function paintFooter() {
    ui.clear(footerBox);
    if (state.toastMsg) {
      const color = state.toastKind === "error" ? PALETTE.danger : PALETTE.success;
      ui.txt(footerBox, state.toastMsg, { fg: color });
    } else {
      ui.txt(footerBox, "");
    }
    ui.txt(footerBox, "1-9 views · ↑↓/jk move · Enter open · q quit · ? help", {
      fg: PALETTE.muted,
    });
  }

  const ctx = {
    app: domainApp,
    renderer,
    ui,
    logs: capture.lines,
    flashes,
    /** Mark a cell key as changed (up/down/info); decays automatically. */
    flash(key, kind) {
      flashes.mark(key, kind);
    },
    get viewId() {
      return state.viewId;
    },
    go(id) {
      state.overlay = null;
      state.viewId = id;
      paint();
    },
    refresh() {
      paint();
    },
    render() {
      paint();
    },
    toast(msg, kind = "info") {
      state.toastMsg = msg;
      state.toastKind = kind;
      if (state.toastTimer) {
        clearTimeout(state.toastTimer);
      }
      state.toastTimer = setTimeout(() => {
        state.toastMsg = null;
        paint();
      }, 3500);
      if (state.toastTimer.unref) {
        state.toastTimer.unref();
      }
      paint();
    },
    showOverlay(overlay) {
      state.overlay = overlay;
      paint();
    },
    openForm(def) {
      state.overlay = createForm(ui, {
        ...def,
        onSubmit: (values) => {
          const error = def.onSubmit(values);
          if (typeof error === "string" && error) {
            return error;
          }
          if (def.toast) {
            ctx.toast(def.toast, def.toastKind || "info");
          }
          view(state.viewId).instance.onReturn?.();
          return null;
        },
      });
      paint();
    },
    confirm(question, onYes) {
      state.overlay = {
        render(parent) {
          const root = ui.box(parent, { padding: 1 });
          ui.txt(root, question, { fg: PALETTE.warning });
          ui.txt(root, "");
          ui.txt(root, "Press y to confirm, n or Esc to cancel", { fg: PALETTE.muted });
        },
        onKey(key, innerCtx) {
          if (!key.ctrl && !key.meta && key.name === "y") {
            state.overlay = null;
            onYes(innerCtx);
            return true;
          }
          if (isEsc(key) || (!key.ctrl && !key.meta && key.name === "n")) {
            state.overlay = null;
            paint();
            return true;
          }
          return false;
        },
      };
      paint();
    },
    closeOverlay() {
      state.overlay = null;
      paint();
    },
    closeForm() {
      state.overlay = null;
      paint();
    },
    exit() {
      destroy();
    },
  };

  function destroy() {
    if (state.destroyed) {
      return;
    }
    state.destroyed = true;
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    if (tickTimer) {
      clearInterval(tickTimer);
    }
    renderer.keyInput.removeAllListeners?.("keypress");
    capture.restore();
    renderer.destroy();
    state.quitResolve();
  }

  // Layout: header / body(sidebar + main) / footer.
  const root = new core.BoxRenderable(renderer, { flexDirection: "column" });
  renderer.root.add(root);
  const headerBox = new core.BoxRenderable(renderer, {
    flexDirection: "row",
    paddingLeft: 1,
    paddingRight: 1,
  });
  root.add(headerBox);
  const bodyBox = new core.BoxRenderable(renderer, { flexDirection: "row", flexGrow: 1 });
  root.add(bodyBox);
  const sidebarBox = new core.BoxRenderable(renderer, {
    flexDirection: "column",
    border: true,
    borderStyle: "single",
    borderColor: PALETTE.border,
    title: "Views",
    padding: 1,
    width: 22,
  });
  bodyBox.add(sidebarBox);
  const mainBox = new core.BoxRenderable(renderer, {
    flexDirection: "column",
    border: true,
    borderStyle: "single",
    borderColor: PALETTE.border,
    flexGrow: 1,
    padding: 1,
  });
  bodyBox.add(mainBox);
  const footerBox = new core.BoxRenderable(renderer, {
    flexDirection: "column",
    paddingLeft: 1,
    paddingRight: 1,
  });
  root.add(footerBox);

  ui.txt(headerBox, "Food Delivery Startup System — TUI", { fg: PALETTE.header });

  // Flash ticker: repaint while change highlights are still decaying.
  // Unref'd so it can never hold the process open past shutdown.
  const tickTimer = setInterval(() => {
    if (!state.destroyed && flashes.active()) {
      paint();
    }
  }, 200);
  if (tickTimer.unref) {
    tickTimer.unref();
  }

  renderer.keyInput.on("keypress", (key) => {
    if (state.destroyed) {
      return;
    }
    // Ctrl+C always quits, even mid-form. Bare "q" must not: overlays own
    // all other keys so typing names like "Aqua" never triggers bindings.
    if (key.ctrl && key.name === "c") {
      destroy();
      return;
    }
    if (state.overlay) {
      if (state.overlay.onKey(key, ctx)) {
        paint();
      }
      return;
    }
    if (isQuit(key)) {
      destroy();
      return;
    }
    if (!key.ctrl && !key.meta && key.name === "?") {
      ctx.go("help");
      return;
    }
    if (!key.ctrl && !key.meta && /^[1-9]$/.test(key.name || "")) {
      const def = VIEW_DEFS.find((v) => v.digit === key.name);
      if (def) {
        ctx.go(def.id);
        return;
      }
    }
    if (view(state.viewId).instance.onKey(key, ctx)) {
      paint();
    }
  });

  paint();
  return { ctx, renderer, quitPromise, destroy };
}

/**
 * Production entry: alternate-screen TUI over the real terminal.
 * Never called from CLI paths; index.js imports this module dynamically.
 */
export async function runTui(domainApp) {
  if (process.stdout.isTTY !== true || process.env.TERM === "dumb") {
    throw new Error(
      "The TUI requires an interactive terminal. Use plain `pnpm start` for the readline menu.",
    );
  }
  const core = await import("@opentui/core");
  const tui = await createTui(domainApp, (opts) => core.createCliRenderer(opts));
  return tui.quitPromise;
}
