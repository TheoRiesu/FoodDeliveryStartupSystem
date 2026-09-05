import { HELP_TEXT, parseArgs, runCommand } from "./cli/commands.js";
import { runInteractive } from "./cli/interactive.js";
import { FoodDeliveryApp } from "./core/app.js";
import { initDatabase } from "./core/database.js";
import { clog } from "./utils/clog.js";

const LOG_TAG = "[src/index.js]";

const db = initDatabase();
clog(console.log, `${LOG_TAG} Database initialized (better-sqlite3 + WAL mode)`);

const app = new FoodDeliveryApp(db);
const argv = process.argv.slice(2);

try {
  if (argv.length === 0 || argv[0] === "interactive") {
    await runInteractive(app);
  } else if (argv[0] === "tui") {
    // Dynamic import: the TUI framework (@opentui/core, --experimental-ffi)
    // must never affect the readline and command-arg paths.
    try {
      const { runTui } = await import("./tui/app.js");
      await runTui(app);
    } catch (err) {
      clog(
        console.error,
        `${LOG_TAG} Failed to start the TUI: ${err.message} (run via \`pnpm tui\` on Node >= 26.4)`,
      );
      process.exitCode = 1;
    }
  } else if (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP_TEXT);
  } else {
    const { command, options } = parseArgs(argv);
    await runCommand(app, command, options);
  }
} catch (err) {
  clog(console.error, `${LOG_TAG} ${err.message}`);
  process.exitCode = 1;
}

process.on("SIGINT", () => {
  clog(console.log, `${LOG_TAG} Shutting down...`);
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  clog(console.log, `${LOG_TAG} Shutting down...`);
  db.close();
  process.exit(0);
});
