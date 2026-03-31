import type { MarketData } from "../domain/MarketData.js";
import type { Position, Transaction } from "../domain/Position.js";
import { HistoricalPriceService, type PricePoint } from "./HistoricalPriceService.js";
import type { GraphRange } from "./types.js";

export interface PortfolioValuePoint {
	date: string;
	value: number;
}

export interface PortfolioHistorySummary {
	currentValue: number;
	startValue: number;
	change: number;
	changePercent: number;
	minValue: number;
	maxValue: number;
	dataPoints: PortfolioValuePoint[];
}

export class PortfolioHistoryService {
	private priceService: HistoricalPriceService;

	constructor(priceService?: HistoricalPriceService) {
		this.priceService = priceService || new HistoricalPriceService();
	}

	async getPortfolioHistory(
		positions: Position[],
		range: GraphRange,
		displayCurrency?: "USD" | "EUR",
		marketData?: MarketData | null,
		currencyConverter?: (amount: number, fromCurrency: string) => number
	): Promise<PortfolioHistorySummary | null> {
		if (positions.length === 0) {
			return null;
		}

		const symbols = positions.map((p) => p.symbol);
		const allPriceHistory = new Map<string, PricePoint[]>();

		const fetchPromises = symbols.map(async (symbol) => {
			const history = await this.priceService.getPriceHistory(symbol, range);
			allPriceHistory.set(symbol, history);
		});

		await Promise.all(fetchPromises);

		const rangeConfig = this.getRangeConfig(range);
		const dates = this.generateDateRange(rangeConfig.days);

		const portfolioValues: PortfolioValuePoint[] = [];

		for (const date of dates) {
			let totalValue = 0;

			for (const position of positions) {
				const priceHistory = allPriceHistory.get(position.symbol) || [];
				const priceOnDate = this.findPriceOnDate(priceHistory, date);

				if (priceOnDate !== null) {
					const sharesAtDate = this.getSharesAtDate(position.transactions, date);
					const positionValue = sharesAtDate * priceOnDate;

					if (currencyConverter && marketData && displayCurrency) {
						try {
							const stock = marketData?.getStock?.(position.symbol);
							const stockCurrency = stock?.price?.currency || "USD";

							if (stockCurrency !== displayCurrency) {
								const convertedValue = currencyConverter(positionValue, stockCurrency);
								totalValue += convertedValue;
							} else {
								totalValue += positionValue;
							}
						} catch (error) {
							console.warn(
								`⚠️ Currency conversion failed for ${position.symbol} on ${date}, using native value:`,
								error
							);
							totalValue += positionValue;
						}
					} else {
						totalValue += positionValue;
					}
				}
			}

			if (totalValue > 0) {
				portfolioValues.push({ date, value: totalValue });
			}
		}

		if (portfolioValues.length === 0) {
			return null;
		}

		const values = portfolioValues.map((p) => p.value);
		const currentValue = values[values.length - 1];
		const startValue = values[0];
		const change = currentValue - startValue;
		const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;
		const minValue = Math.min(...values);
		const maxValue = Math.max(...values);

		return {
			currentValue,
			startValue,
			change,
			changePercent,
			minValue,
			maxValue,
			dataPoints: portfolioValues,
		};
	}

	private getRangeConfig(range: GraphRange): { days: number } {
		const now = new Date();
		switch (range) {
			case "1d":
				return { days: 1 };
			case "5d":
				return { days: 5 };
			case "1mo":
				return { days: 30 };
			case "6mo":
				return { days: 180 };
			case "ytd": {
				const startOfYear = new Date(now.getFullYear(), 0, 1);
				return { days: Math.ceil((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) };
			}
			case "1y":
				return { days: 365 };
			case "5y":
				return { days: 365 * 5 };
			case "max":
				return { days: 365 * 10 };
		}
	}

	private generateDateRange(days: number): string[] {
		const dates: string[] = [];
		const now = new Date();

		for (let i = days; i >= 0; i--) {
			const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
			const dayOfWeek = date.getDay();
			if (dayOfWeek !== 0 && dayOfWeek !== 6) {
				dates.push(date.toISOString().split("T")[0]);
			}
		}

		return dates;
	}

	private findPriceOnDate(priceHistory: PricePoint[], targetDate: string): number | null {
		for (const point of priceHistory) {
			if (point.date === targetDate) {
				return point.price;
			}
		}

		if (priceHistory.length > 0) {
			const closest = priceHistory.reduce((prev, curr) => {
				const prevDiff = Math.abs(new Date(prev.date).getTime() - new Date(targetDate).getTime());
				const currDiff = Math.abs(new Date(curr.date).getTime() - new Date(targetDate).getTime());
				return currDiff < prevDiff ? curr : prev;
			});

			const diff = Math.abs(new Date(closest.date).getTime() - new Date(targetDate).getTime());
			const diffDays = diff / (24 * 60 * 60 * 1000);

			if (diffDays <= 3) {
				return closest.price;
			}
		}

		return null;
	}

	private getSharesAtDate(transactions: Transaction[], targetDate: string): number {
		let shares = 0;

		for (const tx of transactions) {
			if (tx.date <= targetDate) {
				if (tx.type === "BUY") {
					shares += tx.qty;
				} else if (tx.type === "SELL") {
					shares -= tx.qty;
				}
			}
		}

		return Math.max(0, shares);
	}
}
