import { Box, type MouseEvent, Text } from "@opentui/core";

export class DeleteStockTransactionDialog {
	constructor(
		public symbol: string,
		public transactionId: string,

		private confirmDeleteTransaction: () => void,
		private closeDialog: () => void
	) {}

	render() {
		return Box(
			{
				id: "delete-transaction-dialog",
				width: 50,
				flexDirection: "column",
				borderStyle: "double",
				borderColor: "#FF4444",
				backgroundColor: "#08081a",
				padding: 1,
				zIndex: 100,
			},
			Text({ content: "⚠️  DELETE TRANSACTION", fg: "#FF4444", width: 50 }),
			Box({ width: "100%", height: 1 }),
			Text({ content: `Remove this transaction from ${this.symbol}?`, fg: "#FFFFFF", width: 50 }),
			Box({ width: "100%", height: 1 }),
			Box(
				{ width: 50, flexDirection: "row", justifyContent: "center", gap: 3 },
				Box(
					{
						width: 10,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.confirmDeleteTransaction();
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
