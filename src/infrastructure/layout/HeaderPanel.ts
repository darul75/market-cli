import { Box, type MouseEvent, Text } from "@opentui/core";
import type { Observable } from "rxjs";
import type { AppStatus } from "../../application";
import type { MarketData, Position, Stock } from "../../domain";
import { calculatePositionSummary } from "../../domain/PositionCalculator.js";
import { debugLog } from "../../shared/Logger.js";
import { convertPrice } from "../../shared/CurrencyUtils.js";
import type { Currency, SideEffect } from "../types.js";

export class HeaderPanel {
	private _appStatus: AppStatus | null = null;
	private _marketData: MarketData | null = null;
	private _positions: Position[] = [];
	private _exchangeRates: Map<string, number> = new Map();

	constructor(
		private _displayCurrency: Currency = "USD",
		private $sideEffects: Observable<SideEffect>,

		private openSearchDialog: () => void,
		private openPortfolioGraphDialog: () => void,
		private toggleCurrency: () => void
	) {
		this.initListeners();
	}

	render() {
		const portfolioTotal = this.createPortfolioTotalBox();

		if (!this._appStatus) {
			return Box();
		}

		return Box(
			{
				width: "100%",
				height: 3,
				borderStyle: "single",
				borderColor: "#00FF00",
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: "column",
			},
			Box(
				{
					width: "100%",
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				},
				Box(
					{
						flexDirection: "row",
						alignItems: "center",
						gap: 2,
						height: 1,
					},
					Text({
						content: "📈 Stock Live Monitor",
						fg: "#00FF00",
					})
				),
				Box(
					{
						flexDirection: "row",
						alignItems: "center",
						gap: 2,
						height: 1,
					},
					portfolioTotal
				),
				Box(
					{
						flexDirection: "row",
						alignItems: "center",
						gap: 2,
					},
					Text({
						content: `🔍 Search Stocks`,
						fg: "#FFFF00",
						onMouseDown: () => this.openSearchDialog(),
					}),
					Text({
						content: `💰 ${this._displayCurrency}`,
						fg: "#FFFF00",
						onMouseDown: () => this.toggleCurrency(),
					}),
					Text({
						content: this.getStatusIndicator(this._appStatus),
						fg: this._appStatus?.isConnected ? "#00FF00" : "#FF0000",
					})
				)
			)
		);
	}

	handleDelete(stock: Stock): void {
		try {
			const stockSymbol = stock.symbol;
			this._positions = this._positions.filter((p) => p.symbol !== stockSymbol);
		} catch (e) {
			debugLog(`${e}`, "HeaderPanel");
		}
	}

	private initListeners() {
		this.$sideEffects.subscribe((value) => {
			debugLog(JSON.stringify(value), "HeaderPanel");
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
					break;
				default:
					break;
			}
		});
	}

	private createPortfolioTotalBox() {
		const total = this.getPortfolioTotal();
		const currencySymbol = this._displayCurrency === "EUR" ? "€" : "$";
		const valueStr = `${currencySymbol}${total.value.toFixed(0)}`;
		const plSign = total.pl >= 0 ? "+" : "";
		const plColor = total.pl >= 0 ? "#00FF00" : "#FF0000";
		const plStr = `${plSign}${currencySymbol}${total.pl.toFixed(0)} (${plSign}${total.plPercent.toFixed(1)}%)`;

		const hasTransactions = this._positions.some((p) => p.transactions.length > 0);

		return Box(
			{
				id: "portfolio-total",
				flexDirection: "row",
				gap: 2,
				paddingLeft: 1,
				paddingRight: 1,
			},
			Text({
				content: valueStr,
				fg: "#FFFFFF",
			}),
			Text({
				content: plStr,
				fg: plColor,
			}),
			hasTransactions
				? Box(
						{
							width: 3,
							height: 1,
							backgroundColor: "#222244",
							onMouseDown: (e: MouseEvent) => {
								e.stopPropagation();
								this.openPortfolioGraphDialog();
							},
						},
						Text({ content: "📊", width: 2, fg: "#00BFFF" })
					)
				: Box({ width: 3 })
		);
	}

	getPortfolioTotal(): { value: number; invested: number; pl: number; plPercent: number } {
		let totalValue = 0;
		let totalInvested = 0;

		for (const position of this._positions) {
			const stock = this._marketData?.getStock(position.symbol);
			const stockPrice = stock?.price.amount || 0;
			const stockCurrency = stock?.price.currency || "USD";

			const summary = this.calculatePositionSummary(position.symbol, stockPrice);

			try {
				const convertedValue = convertPrice(
					this._exchangeRates,
					summary.currentValue,
					stockCurrency,
					this._displayCurrency
				);
				const convertedInvested = convertPrice(
					this._exchangeRates,
					summary.totalInvested,
					stockCurrency,
					this._displayCurrency
				);

				totalValue += convertedValue;
				totalInvested += convertedInvested;
			} catch (error) {
				debugLog(`⚠️ Skipping ${position.symbol} in portfolio total due to currency conversion error: ${error}`);
			}
		}

		const pl = totalValue - totalInvested;
		const plPercent = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;

		return { value: totalValue, invested: totalInvested, pl, plPercent };
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

	getPosition(symbol: string): Position | undefined {
		return this._positions.find((p) => p.symbol === symbol);
	}

	private getStatusIndicator(status: AppStatus) {
		if (status.isLoading) return "🔄 UPDATING";
		if (status.hasError) return "❌ ERROR";
		if (status.isConnected) return "🟢 LIVE";
		return "🔴 OFFLINE";
	}

	set appStatus(status: AppStatus) {
		this._appStatus = status;
	}

	set marketData(marketData: MarketData) {
		this._marketData = marketData;
	}
}
