import axios, { type AxiosResponse } from "axios";
import { from, mergeMap, type OperatorFunction } from "rxjs";
import type { ApiResponse, StockData } from "../domain/index.js";
import { debugLog } from "../shared/Logger.js";
import { progressTracker } from "../shared/ProgressTracker.js";

export class YahooFinanceClient {
	private readonly baseUrl = "https://query1.finance.yahoo.com";
	private readonly timeout = 10000;
	private readonly requestDelay = 100;
	private readonly concurrency = 8;

	public symbols: string[] = [];

	async testConnection(): Promise<boolean> {
		try {
			const testSymbol = this.symbols.length > 0 ? this.symbols[0] : "AAPL";
			const data = await this.fetchSingleStock(testSymbol);
			return data !== null;
		} catch (error) {
			console.error("Connection test failed:", error);
			return false;
		}
	}

	async fetchStocks(): Promise<ApiResponse & { failedSymbols: string[] }> {
		const symbols = this.symbols;
		const stockData: StockData[] = [];
		const failedSymbols: string[] = [];

		progressTracker.startTracking(symbols.length, Math.ceil(symbols.length / this.concurrency));

		try {
			await new Promise<void>((resolve) => {
				from(symbols)
					.pipe(
						mergeMap((symbol): Promise<void> => {
							progressTracker.updateCurrentSymbol(symbol);
							return (async () => {
								try {
									const data = await this.fetchSingleStock(symbol);
									if (data) {
										stockData.push(data);
										progressTracker.addSuccess();
									} else {
										failedSymbols.push(symbol);
										progressTracker.addError(symbol, "No data returned from API");
									}
								} catch (error: unknown) {
									const errorMessage = error instanceof Error ? error.message : "Unknown error";
									failedSymbols.push(symbol);
									progressTracker.addError(symbol, errorMessage);
								}
								await this.sleep(this.requestDelay);
							})();
						}, this.concurrency) as OperatorFunction<string, void>
					)
					.subscribe({
						complete: () => resolve(),
					});
			});

			if (stockData.length === 0 && failedSymbols.length === symbols.length) {
				throw new Error("No stock data could be fetched from Yahoo Finance API");
			}

			return {
				success: stockData.length > 0,
				data: stockData,
				timestamp: new Date().toISOString(),
				failedSymbols,
				error: failedSymbols.length > 0 ? `${failedSymbols.length} stocks failed to fetch` : undefined,
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			return {
				success: false,
				data: [],
				timestamp: new Date().toISOString(),
				failedSymbols: [...this.symbols],
				error: `Yahoo Finance API Error: ${errorMessage}`,
			};
		}
	}

	public async fetchSingleStock(symbol: string): Promise<StockData | null> {
		return this.fetchSingleStockInternal(symbol);
	}

	public async fetchPriceHistory(
		symbol: string,
		range: string,
		interval: string
	): Promise<{ date: string; price: number }[]> {
		try {
			const now = new Date();
			let period1: number;

			switch (range) {
				case "1d":
					period1 = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000);
					break;
				case "5d":
					period1 = Math.floor((now.getTime() - 5 * 24 * 60 * 60 * 1000) / 1000);
					break;
				case "1mo":
					period1 = Math.floor((now.getTime() - 35 * 24 * 60 * 60 * 1000) / 1000);
					break;
				case "6mo":
					period1 = Math.floor((now.getTime() - 190 * 24 * 60 * 60 * 1000) / 1000);
					break;
				default:
					period1 = Math.floor((now.getTime() - 35 * 24 * 60 * 60 * 1000) / 1000);
			}

			const period2 = Math.floor(now.getTime() / 1000) + 86400;

			const url = `${this.baseUrl}/v8/finance/chart/${symbol}`;
			const response: AxiosResponse = await axios.get(url, {
				timeout: this.timeout,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
				params: {
					period1,
					period2,
					interval,
					includePrePost: false,
					events: "div,splits",
				},
			});

			const chartData = response.data?.chart?.result?.[0];
			if (!chartData) {
				debugLog(`[YahooFinance] ${symbol} no chart data`);
				return [];
			}

			const timestamps = chartData.timestamp as number[] | undefined;
			const closes = chartData.indicators?.quote?.[0]?.close as number[] | undefined;

			if (!timestamps || !closes) {
				debugLog(`[YahooFinance] ${symbol} no timestamps or closes`);
				return [];
			}

			const result: { date: string; price: number }[] = [];
			for (let i = 0; i < timestamps.length; i++) {
				if (closes[i] !== null) {
					const date = new Date(timestamps[i] * 1000);
					const dateStr = interval === "1d" ? date.toISOString().split("T")[0] : date.toISOString().split("T")[0];
					result.push({ date: dateStr, price: closes[i] });
				}
			}

			return result;
		} catch (error) {
			console.warn(`⚠️ Failed to fetch price history for ${symbol}:`, error);
			return [];
		}
	}

	public async fetchHistoricalPrice(symbol: string, date: string, abortSignal?: AbortSignal): Promise<number | null> {
		try {
			const targetDate = new Date(date);
			const period1 = Math.floor(targetDate.getTime() / 1000);
			const period2 = period1 + 86400 * 7;

			const url = `${this.baseUrl}/v8/finance/chart/${symbol}`;

			const response: AxiosResponse = await axios.get(url, {
				signal: abortSignal,
				timeout: this.timeout,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
				params: {
					period1,
					period2,
					interval: "1d",
					includePrePost: false,
					events: "div,splits",
				},
			});

			const chartData = response.data?.chart?.result?.[0];

			if (!chartData) {
				return null;
			}

			const timestamps = chartData.timestamp as number[] | undefined;
			const closes = chartData.indicators?.quote?.[0]?.close as number[] | undefined;

			if (!timestamps || !closes) {
				return null;
			}

			const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
			let closestPrice: number | null = null;
			let closestDiff = Infinity;

			for (let i = 0; i < timestamps.length; i++) {
				const diff = Math.abs(timestamps[i] - targetTimestamp);
				if (diff < closestDiff && closes[i] !== null) {
					closestDiff = diff;
					closestPrice = closes[i];
				}
			}

			return closestPrice;
		} catch (error) {
			console.warn(`⚠️ Failed to fetch historical price for ${symbol} on ${date}:`, error);
			return null;
		}
	}

	private async fetchSingleStockInternal(symbol: string): Promise<StockData | null> {
		try {
			const url = `${this.baseUrl}/v8/finance/chart/${symbol}`;

			const response: AxiosResponse = await axios.get(url, {
				timeout: this.timeout,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
				params: {
					range: "1d",
					interval: "1m",
					includePrePost: false,
					events: "div,splits",
				},
			});

			const chartData = response.data?.chart?.result?.[0];
			if (!chartData) {
				throw new Error("Invalid response structure from Yahoo Finance");
			}

			const meta = chartData.meta;
			if (!meta) {
				throw new Error("Missing metadata in Yahoo Finance response");
			}

			const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
			const previousClose = meta.previousClose || currentPrice;

			const volume = meta.regularMarketVolume || 0;

			return {
				symbol: symbol,
				name: meta.longName || meta.shortName || symbol,
				price: currentPrice,
				previousClose: previousClose,
				volume: volume,
				currency: meta.currency || "USD",
			};
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 401) {
					throw new Error(`Unauthorized access (401) for ${symbol}`);
				} else if (error.response?.status === 404) {
					throw new Error(`Symbol ${symbol} not found (404)`);
				} else if (error.response?.status === 429) {
					throw new Error(`Rate limit exceeded (429) for ${symbol}`);
				} else {
					throw new Error(`HTTP ${error.response?.status}: ${error.message}`);
				}
			} else if (error instanceof Error && error.message.includes("timeout")) {
				throw new Error(`Timeout after ${this.timeout}ms for ${symbol}`);
			} else {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				throw new Error(`Network error for ${symbol}: ${errorMessage}`);
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Fetch multiple exchange rates with USD as reference
	 * Returns map: currency code -> rate (USD per 1 unit of currency)
	 * e.g., { EUR: 0.86, JPY: 0.0067, GBP: 1.27 }
	 *
	 * Yahoo pairs: USD{currency}=X gives "USD per 1 {currency}"
	 * - USDEUR=X → 1 EUR = 0.86 USD
	 * - USDJPY=X → 1 JPY = 0.0067 USD
	 */
	async fetchExchangeRatesToUSD(): Promise<Map<string, number>> {
		const rates = new Map<string, number>();
		const currencies = ["ARS", "EUR", "GBp", "JPY", "GBP", "CHF", "CAD", "AUD", "MXN", "NGN", "CLP", "THB"];

		for (const currency of currencies) {
			try {
				// Use USD{currency}=X to get "USD per 1 {currency}"
				// e.g., USDEUR=X gives EUR to USD rate
				const pair = `USD${currency}=X`;
				const url = `${this.baseUrl}/v8/finance/chart/${pair}`;

				const response = await axios.get(url, {
					timeout: this.timeout,
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				});

				const chartData = response.data?.chart?.result?.[0];
				if (!chartData?.meta?.regularMarketPrice) {
					throw new Error(`Invalid exchange rate response for ${currency}`);
				}

				// USD{currency}=X always returns "currency units per USD"
				// We need "USD per currency unit", so always invert
				let rate = chartData.meta.regularMarketPrice;
				rate = 1 / rate; // Always invert for USD{currency}=X format

				rates.set(currency, rate);
			} catch (error) {
				console.warn(`Failed to fetch USD${currency} rate:`, error);
			}
		}

		return rates;
	}
}
