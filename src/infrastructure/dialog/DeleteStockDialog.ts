import { Box, Text, type MouseEvent } from "@opentui/core";

export class DeleteStockDialog {
	constructor(
		private _symbol: string,

		private handleDeleteBySymbol: (symbol: string) => void,
		private closeDialog: () => void
	) {}

	render() {
		return Box(
			{
				id: "delete-dialog",
				width: 45,
				flexDirection: "column",
				borderStyle: "double",
				borderColor: "#FF4444",
				backgroundColor: "#08081a",
				padding: 1,
				zIndex: 100,
			},
			Text({ content: "⚠️  DELETE STOCK", fg: "#FF4444", width: 45 }),
			Box({ width: "100%", height: 1 }),
			Text({ content: `Remove ${this._symbol} from watchlist?`, fg: "#FFFFFF", width: 45 }),
			Box({ width: "100%", height: 1 }),
			Box(
				{ width: 45, flexDirection: "row", justifyContent: "center", gap: 3 },
				Box(
					{
						width: 10,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.handleDeleteBySymbol(this._symbol);
							this.closeDialog();
						},
					},
					Text({ content: " [Enter] ", fg: "#FF4444", width: 10 })
				),
				Box(
					{
						width: 10,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.closeDialog();
						},
					},
					Text({ content: " [Esc]  ", fg: "#44FF44", width: 10 })
				)
			)
		);
	}
}
