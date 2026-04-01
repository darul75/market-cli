import {
	BehaviorSubject,
	interval,
	Observable,
	switchMap,
	map,
	catchError,
	tap,
	of,
	distinctUntilChanged,
	filter,
	EMPTY,
	concat,
} from "rxjs";
import type { MarketData } from "../domain/index.js";
import { YahooFinanceClient } from "../infrastructure/YahooFinanceClient.js";
import { DataTransformationService } from "../infrastructure/DataTransformationService.js";
import { log } from "../shared/Logger.js";

const debugLog = log("StockDataStream");

export class StockDataStream {
	private readonly apiClient: YahooFinanceClient;
	private readonly transformationService: DataTransformationService;

	private readonly marketDataSubject = new BehaviorSubject<MarketData | null>(null);
	private readonly loadingSubject = new BehaviorSubject<boolean>(false);
	private readonly errorSubject = new BehaviorSubject<string | null>(null);
	private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);

	private trackedSymbols = new Set<string>();

	private refreshIntervalMs: number = 60000;
	private isStarted: boolean = false;
	private retryCount: number = 0;
	private maxRetries: number = 3;
	private initialLoadComplete: boolean = false;
	private enableLiveUpdates: boolean = true;

	constructor() {
		this.apiClient = new YahooFinanceClient();
		this.transformationService = new DataTransformationService();
	}

	public setSymbols(symbols: string[]): void {
		this.apiClient.symbols = symbols;
		this.trackedSymbols = new Set(symbols);
	}

	public removeSymbol(symbol: string): void {
		this.trackedSymbols.delete(symbol);
		this.apiClient.symbols = this.apiClient.symbols.filter((s) => s !== symbol);
	}

	public getApiClient(): YahooFinanceClient {
		return this.apiClient;
	}

	public get marketData$(): Observable<MarketData> {
		return this.marketDataSubject.asObservable().pipe(
			filter((data): data is MarketData => data !== null),
			distinctUntilChanged((prev, curr) => prev.lastUpdate.getTime() === curr.lastUpdate.getTime())
		);
	}

	public get loading$(): Observable<boolean> {
		return this.loadingSubject.asObservable();
	}

	public get error$(): Observable<string | null> {
		return this.errorSubject.asObservable();
	}

	public get connectionStatus$(): Observable<boolean> {
		return this.connectionStatusSubject.asObservable();
	}

	public get status$(): Observable<{
		isLoading: boolean;
		hasError: boolean;
		error: string | null;
		isConnected: boolean;
		lastUpdate: Date | null;
		stockCount: number;
	}> {
		type StatusType = {
			isLoading: boolean;
			hasError: boolean;
			error: string | null;
			isConnected: boolean;
			lastUpdate: Date | null;
			stockCount: number;
		};
		return new Observable<StatusType>((subscriber) => {
			const emitStatus = () => {
				setTimeout(() => {
					const marketData = this.marketDataSubject.value;
					subscriber.next({
						isLoading: this.loadingSubject.value,
						hasError: this.errorSubject.value !== null,
						error: this.errorSubject.value,
						isConnected: this.connectionStatusSubject.value,
						lastUpdate: marketData?.lastUpdate || null,
						stockCount: marketData?.stocks.length || 0,
					});
				}, 0);
			};

			const subscriptions = [
				this.loadingSubject.subscribe(emitStatus),
				this.errorSubject.subscribe(emitStatus),
				this.connectionStatusSubject.subscribe(emitStatus),
				this.marketDataSubject.subscribe(emitStatus),
			];

			emitStatus();

			return () =>
				subscriptions.forEach((s) => {
					s.unsubscribe();
				});
		}).pipe(
			distinctUntilChanged(
				(prev, curr) =>
					prev.isLoading === curr.isLoading &&
					prev.hasError === curr.hasError &&
					prev.error === curr.error &&
					prev.isConnected === curr.isConnected &&
					prev.lastUpdate?.getTime() === curr.lastUpdate?.getTime() &&
					prev.stockCount === curr.stockCount
			)
		);
	}

	public start() {
		if (this.isStarted) {
			return this.marketData$;
		}

		this.isStarted = true;
		this.retryCount = 0;
		this.initialLoadComplete = false;

		if (this.apiClient.symbols.length === 0) {
			const emptyMarketData = new (require("../domain/index.js").MarketData)([], new Date(), true, "");
			this.marketDataSubject.next(emptyMarketData);
			this.loadingSubject.next(false);
			this.connectionStatusSubject.next(true);
			return this.marketData$;
		}

		this.testConnection().catch((error) => {
			debugLog(`⚠️ Initial connection test failed, but continuing with main data fetch:${error.message}`);
		});

		const initialLoad$ = of(0).pipe(
			tap(() => {
				this.loadingSubject.next(true);
				this.errorSubject.next(null);
			}),
			switchMap(() => this.fetchMarketData()),
			map((response) => {
				if (!response.success || !response.data) {
					throw new Error(response.error || "Failed to fetch data");
				}
				this.retryCount = 0;
				this.initialLoadComplete = true;
				const marketData = this.transformationService.transformToMarketData(response.data);
				return marketData;
			}),
			tap(() => {
				this.loadingSubject.next(false);
				this.connectionStatusSubject.next(true);
			}),
			catchError((error) => {
				this.loadingSubject.next(false);
				this.errorSubject.next(error.message);
				this.connectionStatusSubject.next(false);

				this.retryCount++;

				if (this.retryCount >= this.maxRetries) {
					this.isStarted = false;
					return of(null);
				} else {
					return EMPTY;
				}
			}),
			filter((data): data is MarketData => data !== null)
		);

		const liveUpdates$ = this.enableLiveUpdates
			? interval(this.refreshIntervalMs).pipe(
					filter(() => this.initialLoadComplete),
					tap(() => {
						this.loadingSubject.next(true);
						this.errorSubject.next(null);
					}),
					switchMap(() => this.fetchMarketData()),
					map((response) => {
						const previousData = this.marketDataSubject.value;
						const fetchedSymbols = new Set(response.data?.map((d) => d.symbol) || []);
						const previousStocksMap = new Map((previousData?.stocks || []).map((s) => [s.symbol, s]));

						const mergedStocks = [...(response.data || [])].map((d) => {
							const stock = this.transformationService.transformToStock(d);
							return stock;
						});

						for (const symbol of this.trackedSymbols) {
							if (!fetchedSymbols.has(symbol)) {
								const previousStock = previousStocksMap.get(symbol);
								if (previousStock) {
									mergedStocks.push(previousStock);
								} else {
									debugLog(`  ⚠️ ${symbol}: no cached data, attempting fetch...`);
								}
							}
						}

						const mergedSymbols = new Set(mergedStocks.map((s) => s.symbol));
						for (const symbol of this.trackedSymbols) {
							if (!mergedSymbols.has(symbol)) {
								console.log(`  🔄 ${symbol}: will be fetched on next refresh`);
							}
						}

						if (mergedStocks.length === 0 && previousData && previousData.stocks.length > 0) {
							return previousData;
						}

						return this.transformationService.transformToMarketData(
							mergedStocks.map((s) => ({
								symbol: s.symbol,
								name: s.name,
								price: s.price.amount,
								previousClose: s.previousPrice.amount,
								volume: s.volume,
								currency: s.price.currency,
							}))
						);
					}),
					tap(() => {
						this.loadingSubject.next(false);
						this.connectionStatusSubject.next(true);
					}),
					catchError((error) => {
						debugLog(`🔥 Live update error: ${error}`);
						this.loadingSubject.next(false);
						this.errorSubject.next(error.message);
						return EMPTY;
					})
				)
			: EMPTY;

		const combinedStream$ = concat(initialLoad$, liveUpdates$);

		combinedStream$.subscribe({
			next: (marketData: MarketData) => {
				this.marketDataSubject.next(marketData);
			},
			error: (error) => {
				debugLog(`💥 Fatal data stream error: ${error}`);
				this.isStarted = false;
				this.errorSubject.next(`Fatal error: ${error.message}`);
			},
		});

		return this.marketData$;
	}

	public setLiveUpdatesEnabled(enabled: boolean): void {
		this.enableLiveUpdates = enabled;
		debugLog(`🔧 Live updates ${enabled ? "enabled" : "disabled"}`);
	}

	public stop(): void {
		debugLog("⏹️ Stopping stock data stream...");
		this.isStarted = false;
		this.loadingSubject.next(false);
		this.connectionStatusSubject.next(false);
	}

	public setRefreshInterval(intervalMs: number): void {
		if (intervalMs < 1000) {
			throw new Error("Refresh interval must be at least 1 second");
		}
		this.refreshIntervalMs = intervalMs;
		debugLog(`⏱️ Refresh interval updated to ${intervalMs}ms`);
	}

	public getCurrentData(): MarketData | null {
		return this.marketDataSubject.value;
	}

	public async addStock(symbol: string) {
		const currentData = this.marketDataSubject.value;
		if (!currentData) {
			throw new Error("No market data available");
		}

		const existingStock = currentData.stocks.find((s) => s.symbol === symbol);
		if (existingStock) {
			debugLog(`⚠️ ${symbol} is already in the watchlist`);
			return;
		}

		try {
			const stockData = await this.apiClient.fetchSingleStock(symbol);
			if (stockData) {
				const stock = this.transformationService.transformToStock(stockData);
				const updatedStocks = [...currentData.stocks, stock];
				this.marketDataSubject.next(currentData.updateStocks(updatedStocks));
				this.trackedSymbols.add(symbol);
				debugLog(`📊 Added ${symbol} to tracked symbols (${this.trackedSymbols.size} total)`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to add stock ${symbol}: ${errorMessage}`);
		}
	}

	public async refresh(): Promise<void> {
		debugLog("🔄 Force refreshing market data...");
		this.loadingSubject.next(true);
		this.errorSubject.next(null);

		try {
			const response = await this.fetchMarketData();
			if (response.success && response.data) {
				const marketData = this.transformationService.transformToMarketData(response.data);
				this.marketDataSubject.next(marketData);
				this.connectionStatusSubject.next(true);
			} else {
				throw new Error(response.error || "Failed to fetch data");
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.errorSubject.next(errorMessage);
			this.connectionStatusSubject.next(false);
		} finally {
			this.loadingSubject.next(false);
		}
	}

	private async testConnection(): Promise<void> {
		try {
			const isConnected = await this.apiClient.testConnection();
			this.connectionStatusSubject.next(isConnected);

			if (isConnected) {
				debugLog("✅ API connection successful");
			} else {
				debugLog("❌ API connection failed");
			}
		} catch (error) {
			debugLog(`🔌 Connection test failed:${error}`);
			this.connectionStatusSubject.next(false);
		}
	}

	private async fetchMarketData() {
		debugLog("🔍 DEBUG: fetchMarketData() called");
		try {
			const response = await this.apiClient.fetchStocks();
			debugLog(`📊 DEBUG: API response received:${response.success ? "SUCCESS" : "FAILED"}`);
			if (response.success) {
				debugLog(`📈 DEBUG: Fetched ${response.data?.length} stocks successfully`);
			} else {
				debugLog(`❌ DEBUG: API response error:${response.error}`);
			}
			return response;
		} catch (error) {
			debugLog(`❌ DEBUG: fetchMarketData() error:${error}`);
			throw error;
		}
	}
}
