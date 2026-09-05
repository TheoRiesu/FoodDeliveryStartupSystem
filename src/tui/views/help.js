import { PALETTE } from "../../utils/theme.js";
import { cell, headerCell } from "../ui.js";

/** Static keybind and view reference. */
export function createHelpView(ctx) {
  return {
    render(parent) {
      const { ui } = ctx;
      ui.txt(parent, "Help", { fg: PALETTE.header });
      ui.txt(parent, "");
      ui.table(parent, [
        [headerCell("key"), headerCell("action")],
        [cell("1-9"), cell("Switch views (Dashboard … Help)")],
        [cell("↑↓ / j/k"), cell("Move selection in lists")],
        [cell("Enter"), cell("Open detail / edit / submit")],
        [cell("a / e / d / t / x / p / s"), cell("View actions (shown in each footer)")],
        [cell("Tab"), cell("Next form field (Shift+Tab goes back)")],
        [cell("←/→"), cell("Cycle select options in forms")],
        [cell("type to filter"), cell("Narrow picker lists (customer / order / items)")],
        [cell("→/+ and ←/−"), cell("Raise / lower quantity in the order picker")],
        [cell("s"), cell("Cycle drink size (S/M/L) on the picked row")],
        [cell("flashes"), cell("Changed qty/price/status cells glow, then fade to normal")],
        [cell("y / n"), cell("Confirm / dismiss dialogs")],
        [cell("Esc"), cell("Close dialog, back to Dashboard")],
        [cell("q / Ctrl+C"), cell("Quit the TUI")],
      ]);
      ui.txt(parent, "");
      ui.txt(parent, "No IDs to memorize: orders are built by picking a customer,", {
        fg: PALETTE.muted,
      });
      ui.txt(parent, "dialing quantities, and confirming — all from searchable lists.", {
        fg: PALETTE.muted,
      });
      ui.txt(parent, "");
      ui.txt(
        parent,
        "Prefer scripts? Every capability is also a command: run `node src/index.js help`.",
        {
          fg: PALETTE.muted,
        },
      );
    },
    onKey() {
      return false;
    },
  };
}
