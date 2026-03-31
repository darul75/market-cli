import { createCliRenderer, Box, Text, type CliRenderer, type KeyEvent } from "@opentui/core";
import type { MarketData, Position, Transaction } from "../domain/index.js";
import { calculatePositionSummary } from "../domain/PositionCalculator.js";
import type { AppStatus, SearchService, StockDataStream } from "../application/index.js";
import { SearchPanel } from "./search/index.js";
import { PortfolioStore } from "./PortfolioStore.js";
import { HistoricalPriceService } from "./HistoricalPriceService.js";
import { PortfolioHistoryService, type PortfolioHistorySummary } from "./PortfolioHistoryService.js";
import { YahooFinanceClient } from "./YahooFinanceClient.js";
import { StockPanel } from "./stock/StockPanel.js";
import { debugLog } from "../shared/Logger.js";
import { HeaderPanel } from "./layout/HeaderPanel.js";
import { SummaryPanel } from "./layout/SummaryPanel.js";
import { FooterPanel } from "./layout/FooterPanel.js";
import { convertPrice, getNativeCurrencySymbol } from "../shared/CurrencyUtils.js";
import { DeleteStockDialog } from "./dialog/DeleteStockDialog.js";
import { HelpDialog } from "./dialog/HelpDialog.js";
import { DeleteStockTransactionDialog } from "./dialog/DeleteStockTransactionDialog.js";
import type { Currency, DialogFocusedField, DialogMode, GraphRange, SideEffect } from "./types.js";
import { TransactionDialog } from "./dialog/TransactionDialog.js";
import { PortfolioGraphDialog } from "./dialog/PortfolioDialog.js";
import { type Observable, Subject } from "rxjs";
import { generateId } from "../shared/Utils.js";

const APP_VERSION = "0.3.6";

export interface LoadingProgress {
	currentBatch: number;
	totalBatches: number;
	completedStocks: number;
	totalStocks: number;
	currentBatchStocks: string[];
	successCount: number;
	errorCount: number;
	recentErrors: string[];
	elapsedTime: number;
}

export class TerminalRenderer {
	private renderer!: CliRenderer;
	private isInitialized = false;
	private resizeTimeout?: NodeJS.Timeout;
	private _marketData: MarketData | null = null;

	private headerPanel: HeaderPanel | null = null;
	private summaryPanel: SummaryPanel | null = null;
	private stockPanel: StockPanel | null = null;
	private footerPanel: FooterPanel | null = null;
	private _searchPanel: SearchPanel | null = null;

	private transactionDialog: TransactionDialog | null = null;

	private expandedSymbols: Set<string> = new Set();

	private _positions: Position[] = [];
	private portfolioStore: PortfolioStore = new PortfolioStore();
	private historicalPriceService: HistoricalPriceService = new HistoricalPriceService();
	private dataStream: StockDataStream | null = null;

	private displayCurrency: Currency = "USD";
	private exchangeRates: Map<string, number> = new Map();

	private dialogMode: DialogMode = "none";
	private dialogSymbol: string = "";
	private dialogPrice: string = "";
	private dialogMessage: string = "";
	private dialogFetchingPrice: boolean = false;
	private dialogFetchTimer?: NodeJS.Timeout;
	private dialogTransactionSymbol: string = "";
	private dialogTransactionId: string = "";
	private dialogFocusedField: DialogFocusedField = "monthLt";

	private portfolioHistoryService: PortfolioHistoryService = new PortfolioHistoryService();
	private graphSelectedRange: GraphRange = "1mo";
	private graphData: PortfolioHistorySummary | null = null;
	private graphLoading: boolean = false;

	private selectedTransactionId: string | null = null;
	private expandedTransactionSymbol: string | null = null;

	private sideEffects = new Subject<SideEffect>();

	async initialize() {
		try {
			this.renderer = await createCliRenderer({
				exitOnCtrlC: true,
				useMouse: true,
				autoFocus: true,
				enableMouseMovement: true,
			});

			this.headerPanel = new HeaderPanel(
				this.displayCurrency,
				this.$sideEffects,
				() => {
					this.openSearchDialog();
				},
				() => {
					this.openPortfolioGraphDialog();
				},
				() => {
					this.handleToggleCurrency();
				}
			);

			this.summaryPanel = new SummaryPanel();

			this.stockPanel = new StockPanel(
				this.renderer,
				this.portfolioStore,
				getNativeCurrencySymbol(this.displayCurrency),
				this.displayCurrency,
				this.expandedSymbols,
				this.selectedTransactionId,
				this.dialogMode,
				this.$sideEffects,

				(symbol: string) => this.openBuyDialog(symbol),
				(symbol: string) => this.openSellDialog(symbol),
				(symbol: string) => this.openDeleteConfirmDialog(symbol),
				(symbol: string, transactionId: string) => this.openDeleteTransactionDialog(symbol, transactionId),
				() => this.render()
			);

			this.footerPanel = new FooterPanel(APP_VERSION);

			this.initKeyListeners();

			this.isInitialized = true;

			this.setupResizeHandling();
		} catch (error) {
			debugLog(`❌ Failed to initialize OpenTUI renderer: ${error}`);
			throw error;
		}
	}

	/**
	 * Key bindings
	 **/

	private initKeyListeners() {
		this.renderer.prependInputHandler((sequence: string) => {
			debugLog(`key sequence: ${sequence}`);

			if (
				!this.isInputFocused() &&
				sequence === "b" &&
				this.stockPanel?.selectedStockSymbol &&
				this.dialogMode === "none"
			) {
				const stock = this._marketData?.stocks.find((s) => s.symbol === this.stockPanel?.selectedStockSymbol);
				if (stock) {
					this.openBuyDialog(this.stockPanel.selectedStockSymbol);
				} else {
					this.stockPanel.selectedStockSymbol = "";
					if (this.stockPanel) {
						this.stockPanel.currentSelectedIndex = -1;
					}
				}

				return true;
			}

			if (
				!this.isInputFocused() &&
				sequence === "s" &&
				this.stockPanel?.selectedStockSymbol &&
				this.dialogMode === "none"
			) {
				const stock = this._marketData?.stocks.find((s) => s.symbol === this.stockPanel?.selectedStockSymbol);
				if (stock) {
					const pos = this.calculatePositionSummary(this.stockPanel.selectedStockSymbol, 0);
					if (pos.qty > 0) {
						this.openSellDialog(this.stockPanel.selectedStockSymbol);
					}
				} else {
					this.stockPanel.selectedStockSymbol = "";
					if (this.stockPanel) {
						this.stockPanel.currentSelectedIndex = -1;
					}
				}

				return true;
			}

			if (
				!this.isInputFocused() &&
				sequence === "o" &&
				this.stockPanel?.selectedStockSymbol &&
				this.dialogMode === "none"
			) {
				if (this.expandedSymbols.has(this.stockPanel.selectedStockSymbol)) {
					this.expandedSymbols.delete(this.stockPanel.selectedStockSymbol);
				} else {
					this.expandedSymbols.add(this.stockPanel.selectedStockSymbol);
				}
				this.render();

				return true;
			}

			if (
				!this.isInputFocused() &&
				sequence === "d" &&
				this.stockPanel?.selectedStockSymbol &&
				this.dialogMode === "none"
			) {
				const stock = this._marketData?.stocks.find((s) => s.symbol === this.stockPanel?.selectedStockSymbol);
				if (stock) {
					this.openDeleteConfirmDialog(this.stockPanel.selectedStockSymbol);
				} else {
					this.stockPanel.selectedStockSymbol = "";
					if (this.stockPanel) {
						this.stockPanel.currentSelectedIndex = -1;
					}
				}
				return true;
			}

			if (!this.isInputFocused() && sequence === "h" && this.dialogMode === "none") {
				this.openHelpDialog();
				return true;
			}

			if (!this.isInputFocused() && sequence === "f" && this.dialogMode === "none") {
				this.openSearchDialog();
				return true;
			}

			if (!this.isInputFocused() && sequence === "c" && this.dialogMode === "none") {
				this.handleToggleCurrency();
				return true;
			}

			if (
				!this.isInputFocused() &&
				sequence === "x" &&
				this.selectedTransactionId &&
				this.dialogMode === "none" &&
				this.expandedTransactionSymbol
			) {
				this.openDeleteTransactionDialog(this.expandedTransactionSymbol, this.selectedTransactionId);
				return true;
			}

			return false;
		});

		(this.renderer as CliRenderer).keyInput?.on("keypress", (key: KeyEvent) => {
			if (key.name === "escape" && this.dialogMode !== "none") {
				this.closeDialog();
			}

			if (key.name === "return" && this.dialogMode === "search") {
				this._searchPanel?.addStock();
			}

			if (key.name === "return" && this.dialogMode === "buy") {
				this.handleConfirmBuy();
			}
			if (key.name === "return" && this.dialogMode === "sell") {
				this.handleConfirmSell();
			}
			if (key.name === "return" && this.dialogMode === "delete") {
				this.confirmDelete();
			}
			if (key.name === "return" && this.dialogMode === "deleteTransaction") {
				this.handleConfirmDeleteTransaction();
			}

			if (this.dialogMode === "none") {
				if (key.name === "up") {
					if (this.stockPanel) {
						this.stockPanel.moveSelectionUp();
					}
				}
				if (key.name === "down") {
					this.stockPanel?.moveSelectionDown();
				}
			}

			if (this.dialogMode === "search") {
				if (key.name === "up") {
					this._searchPanel?.moveSelectionUp();
				}
				if (key.name === "down") {
					this._searchPanel?.moveSelectionDown();
				}
			}

			if (this.dialogMode === "buy" || this.dialogMode === "sell") {
				if (key.name === "left") {
					this.cycleDialogFocus("left");
				}
				if (key.name === "right") {
					this.cycleDialogFocus("right");
				}
				if (key.name === "up") {
					this.incrementFocusedField();
				}
				if (key.name === "down") {
					this.decrementFocusedField();
				}
				if (key.name === "return") {
					this.actOnFocusedField();
				}
			}
		});
	}

	private setupResizeHandling() {
		if (process.stdout?.on) {
			process.stdout.on("resize", this.handleResize);
		}

		if (process.on) {
			process.on("SIGWINCH", this.handleResize);
		}
	}

	render() {
		if (this._marketData) {
			if (!this.isInitialized) {
				throw new Error("Renderer not initialized. Call initialize() first.");
			}

			try {
				debugLog("Full rendering");

				if (this.stockPanel && this._marketData) {
					this.stockPanel.marketData = this._marketData;
				}
				if (this.headerPanel && this._marketData) {
					this.headerPanel.marketData = this._marketData;
				}
				if (this.summaryPanel && this._marketData) {
					this.summaryPanel.marketData = this._marketData;
				}

				this.clearScreen();

				const content = Box(
					{
						width: "100%",
						flexDirection: "column",
						flexGrow: 1,
					},
					this.headerPanel?.render(),
					this.summaryPanel?.render(),
					this.stockPanel?.render(),
					this.footerPanel?.render()
				);

				this.renderer.root.add(Box({ width: "100%", height: "100%", flexDirection: "column", padding: 1 }, content));

				if (this.dialogMode !== "none") {
					this.renderer.root.add(
						Box(
							{
								id: "dialog-overlay",
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: "100%",
								flexDirection: "row",
								justifyContent: "center",
								alignItems: "center",
								zIndex: 100,
							},
							this.dialogMode === "delete"
								? this.createDeleteConfirmDialog()
								: this.dialogMode === "deleteTransaction"
									? this.createDeleteTransactionDialog()
									: this.dialogMode === "help"
										? this.createHelpDialog()
										: this.dialogMode === "search"
											? this.createSearchDialog()
											: this.dialogMode === "portfolioGraph"
												? this.createPortfolioGraphDialog()
												: this.createTransactionDialog()
						)
					);
				}
			} catch (e) {
				debugLog(`${e}`);
			}
		}
	}

	renderLoading(progress?: LoadingProgress) {
		if (!this.isInitialized) return;

		this.clearScreen();

		const elements = [];

		elements.push(
			Text({
				content: "🔄 Loading data...",
				fg: "#00FF00",
			})
		);

		if (progress) {
			elements.push(
				Box(
					{
						width: "80%",
						flexDirection: "column",
						alignItems: "center",
						marginTop: 2,
						borderStyle: "single",
						borderColor: "#333333",
						padding: 1,
					},
					Text({
						content: `Batch ${progress.currentBatch}/${progress.totalBatches}`,
						fg: "#FFFFFF",
					}),
					Text({
						content: `Stocks: ${progress.completedStocks}/${progress.totalStocks}`,
						fg: "#00BFFF",
					}),
					Text({
						content:
							progress.currentBatchStocks.length > 0
								? `Processing: ${progress.currentBatchStocks.join(", ")}`
								: "Waiting for next batch...",
						fg: "#CCCCCC",
					}),
					Box(
						{
							flexDirection: "row",
							gap: 3,
							marginTop: 1,
						},
						Text({
							content: `✅ Success: ${progress.successCount}`,
							fg: "#00FF00",
						}),
						Text({
							content: `❌ Errors: ${progress.errorCount}`,
							fg: "#FF0000",
						})
					),
					Text({
						content: `Elapsed: ${progress.elapsedTime}s`,
						fg: "#AAAAAA",
					})
				)
			);

			if (progress.recentErrors.length > 0) {
				elements.push(
					Box(
						{
							width: "80%",
							flexDirection: "column",
							marginTop: 1,
							borderStyle: "single",
							borderColor: "#FF0000",
							padding: 1,
						},
						Text({
							content: "Recent Errors:",
							fg: "#FF0000",
						}),
						...progress.recentErrors.slice(0, 3).map((error: string) =>
							Text({
								content: error.length > 60 ? `${error.substring(0, 57)}...` : error,
								fg: "#FF6B6B",
							})
						)
					)
				);
			}
		}

		elements.push(
			Box(
				{
					marginTop: 2,
					flexDirection: "column",
					alignItems: "center",
				},
				Text({
					content: "Please wait while we fetch live market data...",
					fg: "#CCCCCC",
				}),
				Text({
					content: "Press Ctrl+C to cancel",
					fg: "#AAAAAA",
				})
			)
		);

		this.renderer.root.add(
			Box(
				{
					width: "100%",
					height: "100%",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					padding: 2,
				},
				...elements
			)
		);
	}

	renderError(error: string) {
		if (!this.isInitialized) return;

		this.clearScreen();

		this.renderer.root.add(
			Box(
				{
					width: "100%",
					height: "100%",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					padding: 2,
				},
				Text({
					content: "❌ API Connection Failed",
					fg: "#FF0000",
				}),
				Text({
					content: error,
					fg: "#FF6B6B",
				}),
				Text({
					content: "Press Ctrl+C to exit",
					fg: "#CCCCCC",
				})
			)
		);
	}

	isInputFocused(): boolean {
		return this.dialogMode !== "none";
	}

	setupSearchService(searchService: SearchService, onAddStock: (symbol: string, name: string) => void) {
		this._searchPanel = new SearchPanel(searchService, onAddStock, () => this.render());
	}

	setStatus(status: AppStatus) {
		if (this.headerPanel) {
			this.headerPanel.appStatus = status;
		}
		if (this.footerPanel) {
			this.footerPanel.appStatus = status;
		}
	}

	private async refreshPortfolioGraph() {
		if (this.dialogMode !== "portfolioGraph") return;

		this.graphLoading = true;
		this.render();

		const positionsWithTransactions = this._positions.filter((p) => p.transactions.length > 0);
		this.graphData = await this.portfolioHistoryService.getPortfolioHistory(
			positionsWithTransactions,
			this.graphSelectedRange,
			this.displayCurrency,
			this._marketData,
			(amount, fromCurrency) => convertPrice(this.exchangeRates, amount, fromCurrency, this.displayCurrency)
		);
		this.graphLoading = false;
		this.render();
	}

	/**
	 * Http calls
	 **/

	async updateExchangeRate() {
		let apiClient: YahooFinanceClient;

		if (this.dataStream) {
			apiClient = this.dataStream.getApiClient();
		} else {
			apiClient = new YahooFinanceClient();
		}

		try {
			this.exchangeRates = await apiClient.fetchExchangeRatesToUSD();
			this.sideEffects.next({ type: "exchange_rates", data: this.exchangeRates });
		} catch (error) {
			debugLog(`updateExchangeRate: error ${error}`);
		}
	}

	/**
	 * Lifecycle
	 **/
	destroy() {
		if (this.isInitialized) {
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout);
			}

			if (process.stdout?.removeListener) {
				process.stdout.removeListener("resize", this.handleResize);
			}
			if (process.removeListener) {
				process.removeListener("SIGWINCH", this.handleResize);
			}

			if (this._searchPanel) {
				this._searchPanel.destroy();
				this._searchPanel = null;
			}
		}
	}

	private clearScreen() {
		if (!this.isInitialized) return;

		try {
			const children = this.renderer.root.getChildren();
			for (const child of children) {
				if (child?.id) {
					try {
						this.renderer.root.remove(child.id);
					} catch (e) {
						debugLog(`${e}`);
					}
				}
			}
		} catch (e) {
			debugLog(`${e}`);
		}

		this.renderer.focusRenderable(this.renderer.root);
	}

	getPosition(symbol: string): Position | undefined {
		return this._positions.find((p) => p.symbol === symbol);
	}

	addSymbol(symbol: string, name: string): void {
		const existing = this._positions.find((p) => p.symbol === symbol);
		if (!existing) {
			this._positions = [...this._positions, { symbol, name, transactions: [] }];
			this.savePortfolio();
		}
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

	// ========== Dialog Methods ==========

	private cycleDialogFocus(direction: "left" | "right") {
		const order: (typeof this.dialogFocusedField)[] = [
			"monthLt",
			"monthGt",
			"dayLt",
			"dayGt",
			"yearLt",
			"yearGt",
			"qty",
			"price",
			"cancel",
			"ok",
		];
		const idx = order.indexOf(this.dialogFocusedField);
		if (direction === "left") {
			this.dialogFocusedField = order[(idx - 1 + order.length) % order.length];
		} else {
			this.dialogFocusedField = order[(idx + 1) % order.length];
		}
		this.render();
	}

	private incrementFocusedField() {
		if (!this.transactionDialog) {
			return;
		}

		switch (this.dialogFocusedField) {
			case "monthLt":
			case "monthGt":
				this.transactionDialog.incrementMonth();
				break;
			case "dayLt":
			case "dayGt":
				this.transactionDialog.incrementDay();
				break;
			case "yearLt":
			case "yearGt":
				this.transactionDialog.incrementYear();
				break;
			case "qty":
			case "price":
			case "cancel":
			case "ok":
				break;
		}
	}

	private decrementFocusedField() {
		if (!this.transactionDialog) {
			return;
		}
		switch (this.dialogFocusedField) {
			case "monthLt":
			case "monthGt":
				this.transactionDialog.decrementMonth();
				break;
			case "dayLt":
			case "dayGt":
				this.transactionDialog.decrementDay();
				break;
			case "yearLt":
			case "yearGt":
				this.transactionDialog.decrementYear();
				break;
			case "qty":
			case "price":
			case "cancel":
			case "ok":
				break;
		}
	}

	private actOnFocusedField(): void {
		switch (this.dialogFocusedField) {
			case "cancel":
				this.closeDialog();
				break;
			case "ok":
				this.dialogMode === "buy" ? this.handleConfirmBuy() : this.handleConfirmSell();
				break;
			case "qty":
			case "price":
				break;
			default:
				break;
		}
	}

	private scheduleDateChangeFetch(): void {
		if (this.dialogFetchTimer) {
			clearTimeout(this.dialogFetchTimer);
		}
		this.dialogFetchTimer = setTimeout(() => {
			this.fetchHistoricalPrice();
		}, 1000);
	}

	/**
	 * Dialog visibility / dialog actions
	 **/

	private openBuyDialog(symbol: string) {
		this.dialogMode = "buy";
		this.dialogSymbol = symbol;

		const stock = this._marketData?.stocks.find((s) => s.symbol === symbol);
		const convertedPrice = stock ? stock.price.amount : 0;
		this.dialogPrice = convertedPrice > 0 ? convertedPrice.toFixed(2) : "";
		this.dialogFetchingPrice = false;

		this.render();
	}

	private openDeleteConfirmDialog(symbol: string): void {
		this.dialogMode = "delete";
		this.dialogSymbol = symbol;
		this.render();
	}

	private openDeleteTransactionDialog(symbol: string, transactionId: string): void {
		this.dialogMode = "deleteTransaction";
		this.dialogTransactionSymbol = symbol;
		this.dialogTransactionId = transactionId;
		this.render();
	}

	private openHelpDialog(): void {
		this.dialogMode = "help";
		this.render();
	}

	private openSearchDialog(): void {
		this.dialogMode = "search";
		this.render();
	}

	private openSellDialog(symbol: string) {
		this.dialogMode = "sell";
		this.dialogSymbol = symbol;
		this.dialogMessage = "";

		const stock = this._marketData?.stocks.find((s) => s.symbol === symbol);
		const convertedPrice = stock ? stock.price.amount : 0;
		this.dialogPrice = convertedPrice > 0 ? convertedPrice.toFixed(2) : "";
		this.dialogFetchingPrice = false;

		this.render();
	}

	private closeDialog() {
		this.dialogMode = "none";
		this.dialogSymbol = "";
		this.dialogMessage = "";
		this.selectedTransactionId = null;
		this.expandedTransactionSymbol = null;

		this.render();
	}

	private closePortfolioGraphDialog() {
		this.dialogMode = "none";
		this.graphData = null;
		this.render();
	}

	closeSearchDialog() {
		this.dialogMode = "none";
		this.render();
	}

	createDeleteConfirmDialog() {
		return new DeleteStockDialog(this.dialogSymbol, this.handleDeleteBySymbol, this.closeDialog).render();
	}

	confirmDelete() {
		this.handleDeleteBySymbol(this.dialogSymbol);
		this.closeDialog();
	}

	/***
	 * Action handlers
	 **/

	private handleDeleteBySymbol(symbol: string) {
		if (!this._marketData) {
			return;
		}
		const index = this._marketData.stocks.findIndex((s) => s.symbol === symbol);

		if (index !== -1) {
			const stock = this._marketData.stocks[index];
			this._marketData.stocks.splice(index, 1);
			this.sideEffects.next({ type: "delete_symbol", index, stock });
		}

		if (this.dataStream) {
			this.dataStream.removeSymbol(symbol);
		}

		this.render();
	}

	private handleConfirmBuy() {
		if (!this.transactionDialog) {
			return;
		}
		const qty = parseInt(this.transactionDialog.quantity, 10);

		const userEnteredPrice = parseFloat(this.dialogPrice);

		if (Number.isNaN(qty) || qty <= 0) {
			return;
		}
		if (Number.isNaN(userEnteredPrice) || userEnteredPrice <= 0) {
			return;
		}

		const stock = this._marketData?.stocks.find((s) => s.symbol === this.dialogSymbol);
		const name = stock?.name || this.dialogSymbol;
		const dateStr = `${this.transactionDialog.dialogYear}-${String(this.transactionDialog.dialogMonth + 1).padStart(2, "0")}-${String(this.transactionDialog.dialogDay).padStart(2, "0")}`;

		const priceToStore = userEnteredPrice;
		const currencyToStore = stock?.price.currency || "USD";

		const transaction: Transaction = {
			id: generateId(),
			type: "BUY",
			date: dateStr,
			qty,
			pricePerShare: priceToStore,
			currency: currencyToStore,
		};

		this._positions = this.portfolioStore.addTransaction(this.dialogSymbol, name, transaction, this._positions);
		this.sideEffects.next({ type: "portfolio_positions", data: this._positions });

		this.savePortfolio();
		this.closeDialog();
	}

	private handleConfirmSell() {
		if (!this.transactionDialog) {
			return;
		}
		const qty = parseInt(this.transactionDialog.quantity, 10);
		const userEnteredPrice = parseFloat(this.dialogPrice);

		if (Number.isNaN(qty) || qty <= 0) {
			return;
		}
		if (Number.isNaN(userEnteredPrice) || userEnteredPrice <= 0) {
			return;
		}

		const position = this.getPosition(this.dialogSymbol);
		if (!position) {
			return;
		}

		const totalBuys = position.transactions.filter((t) => t.type === "BUY").reduce((sum, t) => sum + t.qty, 0);
		const totalSells = position.transactions.filter((t) => t.type === "SELL").reduce((sum, t) => sum + t.qty, 0);
		const currentQty = totalBuys - totalSells;

		if (currentQty < qty) {
			this.dialogMessage = `Max available: ${currentQty} shares`;
			this.render();
			return;
		}

		const stock = this._marketData?.stocks.find((s) => s.symbol === this.dialogSymbol);
		const name = stock?.name || this.dialogSymbol;
		const dateStr = `${this.transactionDialog.dialogYear}-${String(this.transactionDialog.dialogMonth + 1).padStart(2, "0")}-${String(this.transactionDialog.dialogDay).padStart(2, "0")}`;

		const sellPriceToStore = userEnteredPrice;
		const sellCurrencyToStore = stock?.price.currency || "USD";

		const transaction: Transaction = {
			id: generateId(),
			type: "SELL",
			date: dateStr,
			qty,
			pricePerShare: sellPriceToStore,
			currency: sellCurrencyToStore,
		};

		this._positions = this.portfolioStore.addTransaction(this.dialogSymbol, name, transaction, this._positions);

		this.sideEffects.next({ type: "portfolio_positions", data: this._positions });

		this.savePortfolio();
		this.closeDialog();
	}

	private handleConfirmDeleteTransaction() {
		if (this.dialogTransactionSymbol && this.dialogTransactionId) {
			this._positions = this.portfolioStore.removeTransaction(
				this.dialogTransactionSymbol,
				this.dialogTransactionId,
				this._positions
			);
			this.savePortfolio();
			this.selectedTransactionId = null;
			this.expandedTransactionSymbol = null;
		}
		this.closeDialog();
	}

	private handleToggleCurrency() {
		this.displayCurrency = this.displayCurrency === "USD" ? "EUR" : "USD";

		this.sideEffects.next({ type: "currency", data: this.displayCurrency });

		if (this.dialogMode === "portfolioGraph") {
			this.refreshPortfolioGraph();
		}

		this.render();
	}

	createDeleteTransactionDialog() {
		return new DeleteStockTransactionDialog(
			this.dialogTransactionSymbol,
			() => {
				this.handleConfirmDeleteTransaction();
			},
			() => {
				this.closeDialog;
			}
		).render();
	}

	createHelpDialog() {
		return new HelpDialog(() => this.closeDialog()).render();
	}

	private getMaxSellQty() {
		const position = this.getPosition(this.dialogSymbol);
		if (!position) return 0;
		const totalBuys = position.transactions.filter((t) => t.type === "BUY").reduce((sum, t) => sum + t.qty, 0);
		const totalSells = position.transactions.filter((t) => t.type === "SELL").reduce((sum, t) => sum + t.qty, 0);
		return totalBuys - totalSells;
	}

	async fetchHistoricalPrice(): Promise<void> {
		if (!this.dialogSymbol || this.dialogFetchingPrice || !this.transactionDialog) return;

		const dateStr = `${this.transactionDialog.dialogYear}-${String(this.transactionDialog.dialogMonth + 1).padStart(2, "0")}-${String(this.transactionDialog.dialogDay).padStart(2, "0")}`;

		this.dialogFetchingPrice = true;
		this.render();

		const price = await this.historicalPriceService.getPriceOnDate(this.dialogSymbol, dateStr);

		this.dialogFetchingPrice = false;
		if (price !== null) {
			this.dialogPrice = price.toFixed(2);
		}
		this.render();
	}

	// dialog creation
	private createSearchDialog() {
		if (this.dialogMode !== "search") return null;

		const searchPanelContent = this._searchPanel ? this._searchPanel.render() : null;

		if (!searchPanelContent) {
			return Box(
				{
					id: "search-dialog-fallback",
					width: 76,
					height: 12,
					flexDirection: "column",
					borderStyle: "double",
					borderColor: "#00AAFF",
					backgroundColor: "#08081a",
					padding: 1,
					zIndex: 100,
				},
				Text({ content: "🔍 Search not available", fg: "#FF6666" })
			);
		}

		return searchPanelContent;
	}

	private createTransactionDialog() {
		if (this.dialogMode === "none" || this.dialogMode === "portfolioGraph") return null;

		if (!this.transactionDialog) {
			this.transactionDialog = new TransactionDialog(
				this.dialogMode,
				this.dialogSymbol,
				this.dialogFetchingPrice,
				this.dialogPrice,
				this.dialogFocusedField,
				this.dialogMessage,
				this.getMaxSellQty(),

				() => this.closeDialog(),
				() => this.scheduleDateChangeFetch(),
				() => this.handleConfirmBuy(),
				() => this.handleConfirmSell()
			);
		}

		this.transactionDialog.price = this.dialogPrice;
		this.transactionDialog.quantity = "";
		this.transactionDialog.dialogFocusedField = this.dialogFocusedField;

		return this.transactionDialog.render();
	}

	async openPortfolioGraphDialog(): Promise<void> {
		this.dialogMode = "portfolioGraph";
		this.graphSelectedRange = "1mo";
		this.graphData = null;
		this.graphLoading = true;
		this.render();

		const positionsWithTransactions = this._positions.filter((p) => p.transactions.length > 0);
		this.graphData = await this.portfolioHistoryService.getPortfolioHistory(
			positionsWithTransactions,
			this.graphSelectedRange,
			this.displayCurrency,
			this._marketData,
			(amount, fromCurrency) => convertPrice(this.exchangeRates, amount, fromCurrency, this.displayCurrency)
		);
		this.graphLoading = false;
		this.render();
	}

	async changeGraphRange(range: GraphRange): Promise<void> {
		this.graphSelectedRange = range;
		this.graphLoading = true;
		this.graphData = null;
		this.render();

		const positionsWithTransactions = this._positions.filter((p) => p.transactions.length > 0);
		this.graphData = await this.portfolioHistoryService.getPortfolioHistory(
			positionsWithTransactions,
			range,
			this.displayCurrency,
			this._marketData,
			(amount, fromCurrency) => convertPrice(this.exchangeRates, amount, fromCurrency, this.displayCurrency)
		);
		this.graphLoading = false;
		this.render();
	}

	private createPortfolioGraphDialog() {
		if (this.dialogMode !== "portfolioGraph") return null;

		return new PortfolioGraphDialog(
			this.graphSelectedRange,
			this.graphLoading,
			this.graphData,
			this.displayCurrency,

			(range: GraphRange) => this.changeGraphRange(range),
			() => this.closePortfolioGraphDialog()
		).render();
	}

	/**
	 * Portfolio
	 **/

	async loadPortfolio() {
		this._positions = await this.portfolioStore.load();

		this.sideEffects.next({ type: "portfolio_positions", data: this._positions });

		return this._positions;
	}

	private savePortfolio() {
		this.portfolioStore.save(this._positions);

		this.sideEffects.next({ type: "portfolio_positions", data: this._positions });
	}

	/**
	 * Window resze
	 **/

	private handleResize = () => {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}

		this.resizeTimeout = setTimeout(() => {
			this.preserveRelativeScrollPosition();
			this.restoreRelativeScrollPosition();
		}, 300);
	};

	preserveRelativeScrollPosition() {}

	restoreRelativeScrollPosition() {}

	set data(marketData: MarketData) {
		this._marketData = marketData;
	}

	setDataStream(dataStream: StockDataStream): void {
		this.dataStream = dataStream;
	}

	private get $sideEffects(): Observable<SideEffect> {
		return this.sideEffects.asObservable();
	}
}
