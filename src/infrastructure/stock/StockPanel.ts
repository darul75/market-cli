import { Box, BoxRenderable, type CliRenderer, type MouseEvent, ScrollBoxRenderable, Text } from "@opentui/core";
import type { MarketData, Position, Stock } from "../../domain/index.js";
import { calculatePositionSummary, calculateTransactionsWithPL } from "../../domain/PositionCalculator.js";
import { convertPrice, getNativeCurrencySymbol } from "../../shared/CurrencyUtils.js";
import { debugLog } from "../../shared/Logger.js";
import type { PortfolioStore } from "../PortfolioStore.js";
import type { Observable } from "rxjs";
import type { Currency, SideEffect } from "../types.js";

const HEADER_WIDTH_SYMBOL = 12;
const HEADER_WIDTH_PRICE = 12;
const HEADER_WIDTH_CHANGE = 12;
const HEADER_WIDTH_QUANTITY = 9;
const HEADER_WIDTH_INVESTED = 14;
const HEADER_WIDTH_VALUE = 14;

export class StockPanel {
	// biome-ignore lint/suspicious/noExplicitAny: difficult to type atm
	private scrollableContent: any;
	private _marketData: MarketData | null = null;
	private _exchangeRates: Map<string, number> = new Map();
	private selectedIndex: number = -1;
	private selectedSymbol: string | null = null;
	private _positions: Position[] = [];
	private scrollPosition = 0;

	constructor(
		private renderer: CliRenderer,
		private portfolioStore: PortfolioStore,
		private displayCurrencySymbol = "$",
		private _displayCurrency: Currency = "USD",
		private expandedSymbols: Set<string> = new Set(),
		private selectedTransactionId: string | null = null,
		private dialogMode:
			| "none"
			| "buy"
			| "sell"
			| "portfolioGraph"
			| "delete"
			| "help"
			| "deleteTransaction"
			| "search" = "none",
		private $sideEffects: Observable<SideEffect>,

		private openBuyDialog: (symbol: string) => void,
		private openSellDialog: (symbol: string) => void,
		private openDeleteConfirmDialog: (symbol: string) => void,
		private openDeleteTransactionDialog: (symbol: string, transactionId: string) => void,
		private triggerAppRendering: () => void
	) {
		this.initListeners();
	}

	render() {
		if (this.selectedIndex !== -1 && this._marketData && this.selectedIndex > this._marketData?.stocks?.length - 1) {
			this.selectedIndex -= 1;
		}
		const header = this.createTableHeader();
		this.createTableRows();

		if (this.selectedIndex > 0 && this.dialogMode === "none") {
			setTimeout(() => {
				this.scrollableContent.scrollBy(this.scrollPosition, "absolute");
			}, 0);
		}

		return Box(
			{
				width: "100%",
				flexDirection: "column",
				borderStyle: "single",
				borderColor: "#666666",
				flexGrow: 1,
			},
			header,
			this.scrollableContent
		);
	}

	private initListeners() {
		this.$sideEffects.subscribe((value) => {
			debugLog(JSON.stringify(value), "StockPanel");
			switch (value.type) {
				case "delete_symbol":
					this.handleDelete(value.stock);
					break;
				case "exchange_rates":
					this._exchangeRates = value.data;
					break;
				case "portfolio_positions":
					this._positions = value.data;
					break;
				case "currency":
					this._displayCurrency = value.data;
					this.displayCurrencySymbol = getNativeCurrencySymbol(value.data);
					break;
				default:
					break;
			}
		});
	}

	private createTableRows() {
		const rows = [];

		if (this._marketData?.stocks.length === 0) {
			const box = new BoxRenderable(this.renderer, {
				width: "100%",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: 1,
				paddingTop: 2,
				paddingBottom: 2,
			});

			box.add(
				Text({
					content: "📊 No stocks in portfolio",
					fg: "#00FFFF",
					width: 30,
				})
			);
			rows.push(box);
		} else {
			this._marketData?.stocks.forEach((stock, index) => {
				rows.push(this.createStockRow(stock, index + 1, index % 2 === 0, index === this.selectedIndex));

				if (this.expandedSymbols.has(stock.symbol)) {
					const position = this.getPosition(stock.symbol);
					if (position && position.transactions.length > 0) {
						rows.push(this.createPurchaseHistoryPanel(stock.symbol));
					}
				}
			});
		}

		this.scrollableContent = new ScrollBoxRenderable(this.renderer, {
			width: "100%",
			flexGrow: 1,
			minHeight: 3,
			scrollY: true,
			scrollX: false,
			viewportCulling: true,
		});

		rows.forEach((row) => {
			this.scrollableContent.add(row);
		});

		return Box(
			{
				width: "100%",
				flexDirection: "column",
				borderStyle: "single",
				borderColor: "#666666",
				flexGrow: 1,
			},
			this.createTableHeader(),
			this.scrollableContent
		);
	}

	private createStockRow(stock: Stock, index: number, isEvenRow: boolean = false, isSelected: boolean = false) {
		const changeColor = stock.isPositive ? "#00FF00" : "#FF0000";

		let backgroundColor: string;
		if (isSelected) {
			backgroundColor = "#0055AA";
		} else {
			backgroundColor = isEvenRow ? "#2a2a2a" : "#1a1a1a";
		}

		const symbolColor = isSelected ? "#00FFFF" : "#00BFFF";
		const position = this.getPosition(stock.symbol);
		const stockCurrency = stock.price.currency;
		const nativeSymbol = getNativeCurrencySymbol(stockCurrency);
		const displaySymbol = this.displayCurrencySymbol;
		const nativePrice = stock.price.amount;

		const investedInNative = this.calculateInvestedInNativeCurrency(stock.symbol);
		const convertedPrice = convertPrice(this._exchangeRates, stock.price.amount, stockCurrency, this._displayCurrency);

		const pos = this.calculatePositionSummary(stock.symbol, nativePrice);

		const hasPosition = pos.qty > 0;
		const hasTransactions = position && position.transactions.length > 0;

		const moveUpButton = this.createActionButton(
			"🔼",
			"#00FF00",
			() => this.handleMoveUp(index - 1),
			isSelected,
			!pos.qty || pos.qty === 0 ? 4 : 2
		);
		const moveDownButton = this.createActionButton("🔽", "#FFFF00", () => this.handleMoveDown(index - 1), isSelected);

		const qtyText = hasPosition ? pos.qty.toString() : "-";
		const investedText = hasTransactions ? `${nativeSymbol}${investedInNative.toFixed(0)}` : "-";
		const valueText = hasPosition ? `${displaySymbol}${(convertedPrice * pos.qty).toFixed(0)}` : "-";

		const unrealColor = pos.unrealizedPL >= 0 ? "#00FF00" : "#FF0000";
		const unrealSign = pos.unrealizedPL >= 0 ? "+" : "";
		const unrealText = hasTransactions
			? `${unrealSign}${displaySymbol}${convertPrice(this._exchangeRates, pos.unrealizedPL, stockCurrency, this._displayCurrency).toFixed(0)}`
			: "-";

		const realColor = pos.realizedPL >= 0 ? "#00FF00" : "#FF0000";
		const realSign = pos.realizedPL >= 0 ? "+" : "";
		const realText = hasTransactions
			? `${realSign}${displaySymbol}${convertPrice(this._exchangeRates, pos.realizedPL, stockCurrency, this._displayCurrency).toFixed(0)}`
			: "-";

		const buyBtn = this.createActionButton("📈", "#00FF88", () => this.openBuyDialog(stock.symbol), isSelected, 0);
		const sellBtn = this.createActionButton(
			"📉",
			"#FF8888",
			() => this.openSellDialog(stock.symbol),
			!(!hasPosition || !isSelected),
			1
		);
		const deleteBtn = this.createActionButton(
			"❌",
			"#FF0000",
			() => this.openDeleteConfirmDialog(stock.symbol),
			isSelected,
			1
		);

		const isExpanded = this.expandedSymbols.has(stock.symbol);
		const detailsBtn = this.createActionButton(
			"📋",
			isExpanded ? "#00FFFF" : "#888888",
			() => {
				if (isExpanded) {
					this.expandedSymbols.delete(stock.symbol);
				} else {
					this.expandedSymbols.add(stock.symbol);
				}
				this.triggerAppRendering();
			},
			isSelected && hasTransactions,
			1
		);

		const buttonSpacer = Box({ width: 1, height: 1, backgroundColor: "transparent" }, Text({ content: "", width: 1 }));

		return Box(
			{
				id: `stock-row-${stock.symbol}-${index}`,
				width: "100%",
				height: 1,
				flexDirection: "row",
				alignItems: "center",
				backgroundColor,
				focusable: true,
				paddingLeft: 1,
				paddingRight: 1,
				onMouseDown: (event) => {
					if (this.dialogMode !== "none") return;
					if (event.button === 0) {
						this.handleRowClick(stock, index - 1);
					}
				},
			},
			Text({ content: index.toString(), width: 5, fg: "#CCCCCC" }),
			Text({ content: stock.symbol, width: HEADER_WIDTH_SYMBOL, fg: symbolColor }),
			Text({ content: this.truncateName(stock.name, 19), width: 20, fg: "#888888" }),
			Text({ content: `${nativeSymbol}${nativePrice.toFixed(2)}`, width: HEADER_WIDTH_PRICE, fg: "#FFFFFF" }),
			Text({ content: stock.formattedPriceChange, width: HEADER_WIDTH_CHANGE, fg: changeColor }),
			Text({ content: qtyText, width: HEADER_WIDTH_QUANTITY, fg: hasPosition ? "#FFFFFF" : "#666666" }),
			Text({ content: investedText, width: HEADER_WIDTH_INVESTED, fg: hasTransactions ? "#888888" : "#666666" }),
			Text({ content: valueText, width: HEADER_WIDTH_VALUE, fg: hasPosition ? "#FFFFFF" : "#666666" }),
			Text({ content: unrealText, width: HEADER_WIDTH_VALUE, fg: hasPosition ? unrealColor : "#666666" }),
			Text({ content: realText, width: 10, fg: hasTransactions && pos.realizedPL !== 0 ? realColor : "#666666" }),
			buyBtn,
			sellBtn,
			detailsBtn,
			buttonSpacer,
			moveUpButton,
			buttonSpacer,
			moveDownButton,
			deleteBtn
		);
	}

	getPosition(symbol: string): Position | undefined {
		return this._positions.find((p) => p.symbol === symbol);
	}

	private createTableHeader() {
		return Box(
			{
				width: "100%",
				height: 1,
				backgroundColor: "#333333",
				flexDirection: "row",
				paddingLeft: 1,
				paddingRight: 1,
			},
			Text({ content: "#", width: 5, fg: "#FFFFFF" }),
			Text({ content: "Symbol", width: HEADER_WIDTH_SYMBOL, fg: "#FFFFFF" }),
			Text({ content: "Name", width: 20, fg: "#FFFFFF" }),
			Text({ content: "Price", width: HEADER_WIDTH_PRICE, fg: "#FFFFFF" }),
			Text({ content: "Change", width: HEADER_WIDTH_CHANGE, fg: "#FFFFFF" }),
			Text({ content: "Qty", width: HEADER_WIDTH_QUANTITY, fg: "#FFFFFF" }),
			Text({ content: "Invested", width: HEADER_WIDTH_INVESTED, fg: "#FFFFFF" }),
			Text({ content: "Value", width: HEADER_WIDTH_VALUE, fg: "#FFFFFF" }),
			Text({ content: "Unreal.", width: HEADER_WIDTH_VALUE, fg: "#FFFFFF" }),
			Text({ content: "Real.", width: 10, fg: "#FFFFFF" }),
			Text({ content: "Actions", width: 15, fg: "#FFFFFF" })
		);
	}

	private createPurchaseHistoryPanel(symbol: string) {
		const position = this.getPosition(symbol);
		if (!position || !this.expandedSymbols.has(symbol)) {
			return null;
		}

		const stock = this._marketData?.stocks.find((s) => s.symbol === symbol);
		const convertedPrice = stock ? stock.price.amount : 0;
		const displaySymbol = this.displayCurrencySymbol;

		const transactionsWithPL = calculateTransactionsWithPL(position.transactions, convertedPrice);

		const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

		const formatDate = (dateStr: string) => {
			const parts = dateStr.split("-");
			if (parts.length === 3) {
				const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
				return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
			}
			return dateStr;
		};

		const transactionRows = transactionsWithPL.map((t) => {
			const isSelected = t.id === this.selectedTransactionId;
			const plColor = t.pl >= 0 ? "#00FF00" : "#FF0000";
			const plSign = t.pl >= 0 ? "+" : "";
			const typeColor = t.type === "BUY" ? "#00FF00" : "#FF8888";
			const typeLabel = t.type === "BUY" ? "BUY" : "SELL";

			const originalTransaction = position.transactions.find((orig) => orig.id === t.id);
			const origCurrency = originalTransaction?.currency || "USD";
			const origSymbol = getNativeCurrencySymbol(origCurrency);
			const originalPrice = originalTransaction?.pricePerShare || t.pricePerShare;

			return Box(
				{
					width: "100%",
					flexDirection: "row",
					paddingLeft: 2,
					backgroundColor: isSelected ? "#553300" : "transparent",
					onMouseDown: (e: MouseEvent) => {
						e.stopPropagation();
						this.selectedTransactionId = isSelected ? null : t.id;
						this.triggerAppRendering();
					},
				},
				Text({ content: formatDate(t.date), width: 14, fg: "#AAAAAA" }),
				Text({ content: typeLabel, width: 7, fg: typeColor }),
				Text({ content: `${origSymbol}${originalPrice.toFixed(2)}`, width: 12, fg: "#888888" }),
				Text({ content: String(t.qty), width: 10, fg: "#FFFFFF" }),
				Text({
					content: `${plSign}${displaySymbol}${convertPrice(this._exchangeRates, t.pl, t.currency, this._displayCurrency).toFixed(0)}`,
					width: 12,
					fg: plColor,
				}),
				Text({ content: `${plSign}${t.plPercent.toFixed(0)}%`, width: 8, fg: plColor }),
				Text({
					content: `${displaySymbol}${convertPrice(this._exchangeRates, t.currentValue, t.currency, this._displayCurrency).toFixed(0)}`,
					width: 12,
					fg: "#FFFFFF",
				}),
				Box(
					{
						width: 3,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.openDeleteTransactionDialog(symbol, t.id);
						},
					},
					Text({ content: "❌", fg: isSelected ? "#FF4444" : "#444444" })
				)
			);
		});

		const headerRow = Box(
			{
				width: "100%",
				flexDirection: "row",
				backgroundColor: "#1a1a1a",
				paddingLeft: 2,
			},
			Text({ content: "Date", width: 14, fg: "#666666" }),
			Text({ content: "Type", width: 7, fg: "#666666" }),
			Text({ content: "Price", width: 12, fg: "#666666" }),
			Text({ content: "Qty", width: 10, fg: "#666666" }),
			Text({ content: "Gain", width: 12, fg: "#666666" }),
			Text({ content: "%", width: 8, fg: "#666666" }),
			Text({ content: "Value", width: 12, fg: "#666666" }),
			Text({ content: "", width: 3, fg: "#666666" })
		);

		return Box(
			{
				width: "100%",
				flexDirection: "column",
				borderStyle: "single",
				borderColor: "#444444",
				backgroundColor: "#0a0a0a",
				padding: 0,
			},
			headerRow,
			...transactionRows
		);
	}

	private createActionButton(
		symbol: string,
		color: string,
		handler: () => void,
		isVisible: boolean = true,
		marginLeft: number = 0
	) {
		if (!isVisible) {
			return Box(
				{
					width: 2,
					height: 1,
					backgroundColor: "transparent",
					marginLeft,
				},
				Text({ content: " ", width: 1 })
			);
		}

		return Box(
			{
				width: 2,
				height: 1,
				marginLeft,
				onMouseDown: (event) => {
					event.stopPropagation();
					handler();
				},
			},
			Text({ content: symbol, width: 2, fg: color })
		);
	}

	// events

	private handleRowClick(stock: Stock, index: number): void {
		if (this.selectedIndex === index) {
			this.selectedIndex = -1;
			this.selectedSymbol = null;
			this.scrollPosition = this.scrollableContent.verticalScrollBar.scrollPosition;
		} else {
			this.selectedIndex = index;
			this.selectedSymbol = stock.symbol;
			this.scrollPosition = this.scrollableContent.verticalScrollBar.scrollPosition;
		}

		this.triggerAppRendering();
	}

	moveSelectionDown() {
		if (!this._marketData) {
			return;
		}
		const stockCount = this._marketData?.stocks.length || 0;
		if (stockCount === 0) return;

		if (this.selectedIndex < 0) {
			this.selectedIndex = 0;
		} else if (this.selectedIndex >= stockCount - 1) {
			this.selectedIndex = 0;
		} else {
			this.selectedIndex = this.selectedIndex + 1;
		}
		this.selectedSymbol = this._marketData.stocks[this.selectedIndex].symbol;

		this.triggerAppRendering();
	}

	moveSelectionUp() {
		if (!this._marketData) {
			return;
		}
		const stockCount = this._marketData?.stocks.length || 0;
		if (stockCount === 0) return;

		if (this.selectedIndex <= 0) {
			this.selectedIndex = stockCount - 1;
		} else {
			this.selectedIndex = this.selectedIndex - 1;
		}
		this.selectedSymbol = this._marketData.stocks[this.selectedIndex].symbol;

		this.triggerAppRendering();
	}

	private handleMoveUp(index: number): void {
		if (index <= 0) return;
		if (!this._marketData) {
			return;
		}

		const stock = this._marketData.stocks[index];
		const prevStock = this._marketData.stocks[index - 1];

		this._marketData.stocks[index] = prevStock;
		this._marketData.stocks[index - 1] = stock;

		const stockIdx = this._positions.findIndex((p) => p.symbol === stock.symbol);
		const prevIdx = this._positions.findIndex((p) => p.symbol === prevStock.symbol);
		if (stockIdx > -1 && prevIdx > -1) {
			[this._positions[stockIdx], this._positions[prevIdx]] = [this._positions[prevIdx], this._positions[stockIdx]];
		}

		this.selectedIndex = index - 1;
		this.portfolioStore.save(this._positions);
		this.triggerAppRendering();
	}

	private handleMoveDown(index: number) {
		if (!this._marketData) {
			return;
		}

		if (index >= this._marketData.stocks.length - 1) return;

		const stock = this._marketData.stocks[index];
		const nextStock = this._marketData.stocks[index + 1];

		this._marketData.stocks[index] = nextStock;
		this._marketData.stocks[index + 1] = stock;

		const stockIdx = this._positions.findIndex((p) => p.symbol === stock.symbol);
		const nextIdx = this._positions.findIndex((p) => p.symbol === nextStock.symbol);
		if (stockIdx > -1 && nextIdx > -1) {
			[this._positions[stockIdx], this._positions[nextIdx]] = [this._positions[nextIdx], this._positions[stockIdx]];
		}

		this.selectedIndex = index + 1;
		this.portfolioStore.save(this._positions);
		this.triggerAppRendering();
	}

	handleDelete(stock: Stock) {
		try {
			if (!this._marketData) {
				return;
			}
			this._positions = this._positions.filter((p) => p.symbol !== stock.symbol);

			if (this.selectedIndex >= this._marketData.stocks.length) {
				this.selectedIndex = Math.max(0, this._marketData.stocks.length - 1);
			}

			if (this._marketData.stocks.length > 0 && this.selectedIndex >= 0) {
				this.selectedSymbol = this._marketData.stocks[this.selectedIndex].symbol;
			} else {
				this.selectedSymbol = null;
				this.selectedIndex = -1;
			}

			this.portfolioStore.save(this._positions);
		} catch (e) {
			debugLog(`${e}`, "StockPanel");
		}
	}

	private calculateInvestedInNativeCurrency(symbol: string) {
		const position = this.getPosition(symbol);
		if (!position || position.transactions.length === 0) return 0;

		let invested = 0;
		for (const t of position.transactions) {
			if (t.type === "BUY") {
				invested += t.qty * t.pricePerShare;
			} else if (t.type === "SELL") {
				invested -= t.qty * t.pricePerShare;
			}
		}
		return invested;
	}

	private calculatePositionSummary(symbol: string, currentPrice: number) {
		const position = this.getPosition(symbol);
		if (!position || position.transactions.length === 0) {
			return {
				qty: 0,
				totalInvested: 0,
				avgCost: 0,
				currentValue: 0,
				unrealizedPL: 0,
				unrealizedPLPercent: 0,
				realizedPL: 0,
			};
		}

		return calculatePositionSummary(position.transactions, currentPrice);
	}

	private truncateName(name: string, maxLength: number): string {
		if (name.length <= maxLength) {
			return name;
		}
		return `${name.substring(0, maxLength - 3)}...`;
	}

	set marketData(marketData: MarketData) {
		this._marketData = marketData;
	}

	set currentSelectedIndex(index: number) {
		this.selectedIndex = index;
	}

	get selectedStockSymbol() {
		return this.selectedSymbol;
	}

	set selectedStockSymbol(symbol: string | null) {
		this.selectedSymbol = symbol;
	}
}
