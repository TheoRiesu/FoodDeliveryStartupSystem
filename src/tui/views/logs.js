import { PALETTE } from "../../utils/theme.js";

/** Operational log lines captured while the TUI owns the screen. */
export function createLogsView(ctx) {
  return {
    render(parent) {
      const { ui } = ctx;
      ui.txt(
        parent,
        `Logs (last ${ctx.logs.length} lines, stdout is captured while the TUI runs)`,
        {
          fg: PALETTE.header,
        },
      );
      ui.txt(parent, "");
      const height = Math.max(process.stdout.rows - 14, 5);
      for (const line of ctx.logs.slice(-height)) {
        const color =
          line.level === "error"
            ? PALETTE.danger
            : line.level === "warn"
              ? PALETTE.warning
              : undefined;
        ui.txt(parent, line.text, color ? { fg: color } : {});
      }
    },
    onKey() {
      return false;
    },
  };
}
