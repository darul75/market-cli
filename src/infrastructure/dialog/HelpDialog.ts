import { Box, type MouseEvent, Text } from "@opentui/core";

const shortcuts = [
	{ key: "↑ / ↓", action: "Navigate stocks" },
	{ key: "f", action: "Search stocks" },
	{ key: "b", action: "Buy dialog (stock selected)" },
	{ key: "s", action: "Sell dialog (stock selected)" },
	{ key: "d", action: "Delete confirmation (stock selected)" },
	{ key: "o", action: "Toggle transaction history (stock selected)" },
	{ key: "x", action: "Delete selected transaction" },
	{ key: "c", action: "Toggle USD/EUR currency" },
	{ key: "← / →", action: "Cycle date/input focus" },
	{ key: "↑ / ↓", action: "Change focused date" },
	{ key: "Enter", action: "Confirm dialog" },
	{ key: "Esc", action: "Close dialog / Cancel" },
	{ key: "h", action: "Show this help" },
];

export class HelpDialog {
	constructor(private closeDialog: () => void) {}

	render() {
		const maxKeyWidth = Math.max(...shortcuts.map((s) => s.key.length));
		const maxActionWidth = Math.max(...shortcuts.map((s) => s.action.length));
		const dialogWidth = Math.max(50, maxKeyWidth + maxActionWidth + 8);

		return Box(
			{
				id: "help-dialog",
				width: dialogWidth,
				flexDirection: "column",
				borderStyle: "double",
				borderColor: "#4488FF",
				backgroundColor: "#08081a",
				padding: 1,
				zIndex: 100,
			},
			Text({ content: "⌨️  KEYBOARD SHORTCUTS", fg: "#4488FF", width: dialogWidth }),
			Box({ width: "100%", height: 1 }),
			...shortcuts.flatMap((s) => [
				Box(
					{ width: dialogWidth, flexDirection: "row" },
					Text({ content: `  ${s.key.padEnd(maxKeyWidth)}  `, fg: "#FFFF00", width: maxKeyWidth + 4 }),
					Text({ content: s.action, fg: "#FFFFFF", width: maxActionWidth })
				),
				Box({ width: "100%", height: 0 }),
			]),
			Box({ width: "100%", height: 1 }),
			Box(
				{ width: dialogWidth, flexDirection: "row", justifyContent: "center" },
				Box(
					{
						width: 16,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.closeDialog();
						},
					},
					Text({ content: " [Esc] Close ", fg: "#44FF44", width: 16 })
				)
			)
		);
	}
}
