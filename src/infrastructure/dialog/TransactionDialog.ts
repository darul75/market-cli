import { Box, Input, InputRenderableEvents, type MouseEvent, Text } from "@opentui/core";
import type { DialogFocusedField, DialogMode } from "../types";

export class TransactionDialog {
	private _dialogMonth: number = new Date().getMonth();
	private _dialogDay: number = new Date().getDate();
	private _dialogYear: number = new Date().getFullYear();
	private _quantity: string = "";

	constructor(
		private _dialogMode: DialogMode,
		private _dialogSymbol: string,
		private _fetchingPrice: boolean,
		private _price: string,
		private _dialogFocusedField: string,
		private _dialogMessage: string,
		private _maxSaleQty: number,

		private closeDialog: () => void,
		private scheduleDateChangeFetch: () => void,
		private confirmBuy: () => void,
		private confirmSell: () => void
	) {}

	render() {
		const FOCUS_FG = "#00FFFF";

		const isBuy = this._dialogMode === "buy";
		const symbol = this._dialogSymbol;
		const title = isBuy ? `BUY: ${symbol}` : `SELL: ${symbol}`;
		const titleColor = isBuy ? "#00FF88" : "#FF6666";
		const loading = this._fetchingPrice;

		const qtyInput = Input({
			width: 10,
			maxLength: 8,
			placeholder: "0",
			value: this._quantity,
			id: "transaction-quantity-input",
		});
		qtyInput.focus();
		qtyInput.on(InputRenderableEvents.INPUT, (value: string) => {
			this._quantity = value;
		});

		const priceInput = Input({ width: 12, maxLength: 10, placeholder: "0.00", value: this._price });
		priceInput.on(InputRenderableEvents.INPUT, (value: string) => {
			this._price = value;
		});

		const okBtnFg = loading ? "#666666" : "#00FF00";
		const okBtnText = loading ? " Loading... " : "  [OK]  ";

		const arrowBtn = (
			label: string,
			onClick: () => void,
			disabled: boolean,
			focusKey: typeof this._dialogFocusedField
		) => {
			const isFocused = this._dialogFocusedField === focusKey && !disabled;
			const fg = isFocused ? FOCUS_FG : disabled ? "#444444" : "#00AAFF";
			return Box(
				{
					width: 2,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					height: 1,
					onMouseDown: disabled
						? undefined
						: (e: MouseEvent) => {
								e.stopPropagation();
								onClick();
								this.render();
							},
				},
				Text({ content: label, width: 2, fg })
			);
		};

		const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

		return Box(
			{
				id: "transaction-dialog",
				width: 55,
				flexDirection: "column",
				borderStyle: "double",
				borderColor: titleColor,
				backgroundColor: "#08081a",
				padding: 1,
				zIndex: 100,
			},
			Text({ content: title, fg: titleColor }),
			Box({ width: "100%", height: 1 }),

			Box(
				{ width: "100%", flexDirection: "row", alignItems: "center", gap: 0 },
				Text({ content: "Date: ", width: 9, fg: "#888888" }),
				arrowBtn("<", () => this.decrementMonth(), loading, "monthLt"),
				Text({ content: shortMonths[this._dialogMonth], width: 4, fg: "#FFFFFF" }),
				arrowBtn(">", () => this.incrementMonth(), loading, "monthGt"),
				Box({ width: 2 }),
				arrowBtn("<", () => this.decrementDay(), loading, "dayLt"),
				Text({ content: String(this._dialogDay).padStart(2, "0"), width: 3, fg: "#FFFFFF" }),
				arrowBtn(">", () => this.incrementDay(), loading, "dayGt"),
				Box({ width: 2 }),
				arrowBtn("<", () => this.decrementYear(), loading, "yearLt"),
				Text({ content: String(this._dialogYear), width: 5, fg: "#FFFFFF" }),
				arrowBtn(">", () => this.incrementYear(), loading, "yearGt")
			),
			Box({ width: "100%", height: 2 }),

			Box(
				{ width: "100%", flexDirection: "row", alignItems: "center", gap: 1, height: 1 },
				Text({ content: "Qty: ", width: 7, fg: "#888888" }),
				Box({ borderStyle: "rounded", paddingLeft: 1, borderColor: "#666666" }, qtyInput),
				!isBuy
					? Box({ flexDirection: "row" }, Text({ content: ` (max: ${this._maxSaleQty})`, fg: "#666666" }))
					: Box({})
			),

			Box({ width: "100%", height: 2 }),

			Box(
				{ width: "100%", flexDirection: "row", alignItems: "center", gap: 1, height: 1 },
				Text({ content: "Price: ", width: 7, fg: "#888888" }),
				Box({ borderStyle: "rounded", paddingLeft: 1, borderColor: "#666666" }, priceInput)
			),

			Box({ width: "100%", height: 1 }),

			this._dialogMessage
				? Box(
						{ width: "100%", flexDirection: "row", justifyContent: "center" },
						Text({ content: this._dialogMessage, fg: "#FF4444" })
					)
				: Box({ width: "100%", height: 1 }),

			Box({ width: "100%", height: 1 }),

			Box(
				{ width: "100%", flexDirection: "row", justifyContent: "center", gap: 10 },
				Box(
					{
						width: 9,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.closeDialog();
						},
					},
					Text({ content: " [Cancel] ", width: 9, fg: "#FF4444" })
				),
				Box(
					{
						width: 9,
						height: 1,
						onMouseDown: loading
							? undefined
							: (e: MouseEvent) => {
									e.stopPropagation();
									isBuy ? this.confirmBuy() : this.confirmSell();
								},
					},
					Text({ content: okBtnText, width: 9, fg: okBtnFg })
				)
			)
		);
	}

	incrementDay() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;

		const daysInMonth = new Date(this._dialogYear, this._dialogMonth + 1, 0).getDate();
		this._dialogDay++;
		if (this._dialogDay > daysInMonth) {
			this._dialogDay = 1;
			this.incrementMonth();
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	decrementDay() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;

		const daysInPrevMonth = new Date(this._dialogYear, this._dialogMonth, 0).getDate();
		this._dialogDay--;
		if (this._dialogDay < 1) {
			this._dialogDay = daysInPrevMonth;
			this.decrementMonth();
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	incrementMonth() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;
		this._dialogMonth++;
		if (this._dialogMonth > 11) {
			this._dialogMonth = 0;
			this._dialogYear++;
		}
		const daysInMonth = new Date(this._dialogYear, this._dialogMonth + 1, 0).getDate();
		if (this._dialogDay > daysInMonth) {
			this._dialogDay = daysInMonth;
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	incrementYear() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;
		this._dialogYear++;
		const daysInMonth = new Date(this._dialogYear, this._dialogMonth + 1, 0).getDate();
		if (this._dialogDay > daysInMonth) {
			this._dialogDay = daysInMonth;
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	decrementYear() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;
		this._dialogYear--;
		const daysInMonth = new Date(this._dialogYear, this._dialogMonth + 1, 0).getDate();
		if (this._dialogDay > daysInMonth) {
			this._dialogDay = daysInMonth;
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	decrementMonth() {
		const previousYear = this._dialogYear;
		const previousMonth = this._dialogMonth;
		const previousDay = this._dialogDay;
		this._dialogMonth--;
		if (this._dialogMonth < 0) {
			this._dialogMonth = 11;
			this._dialogYear--;
		}
		const daysInMonth = new Date(this._dialogYear, this._dialogMonth + 1, 0).getDate();
		if (this._dialogDay > daysInMonth) {
			this._dialogDay = daysInMonth;
		}

		if (!this.isDateWithinValidRange()) {
			this._dialogYear = previousYear;
			this._dialogMonth = previousMonth;
			this._dialogDay = previousDay;
			return;
		}

		this.scheduleDateChangeFetch();
	}

	private getMinDate(): Date {
		const today = new Date();
		return new Date(today.getFullYear() - 50, today.getMonth(), today.getDate());
	}
	private getMaxDate(): Date {
		return new Date();
	}
	private getCurrentSelectedDate(): Date {
		return new Date(this._dialogYear, this._dialogMonth, this._dialogDay);
	}

	private isDateWithinValidRange(): boolean {
		const selected = this.getCurrentSelectedDate();
		const min = this.getMinDate();
		const max = this.getMaxDate();
		return selected >= min && selected <= max;
	}

	get quantity() {
		return this._quantity;
	}

	set quantity(qty: string) {
		this._quantity = qty;
	}

	get dialogYear() {
		return this._dialogYear;
	}

	get dialogMonth() {
		return this._dialogMonth;
	}

	get dialogDay() {
		return this._dialogDay;
	}

	get price() {
		return this._price;
	}

	set price(price: string) {
		this._price = price;
	}

	set dialogFocusedField(focusField: DialogFocusedField) {
		this._dialogFocusedField = focusField;
	}
}
