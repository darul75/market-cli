import { type Observable, map, startWith } from "rxjs";
import type { MarketData, Stock } from "../domain/index.js";
import { SearchService } from "./SearchService.js";
import { StockDataStream } from "./StockDataStream.js";

export class StockMonitorApp {
	private readonly dataStream: StockDataStream;
	private readonly searchService: SearchService;
	private isRunning: boolean = false;

	constructor() {
		this.dataStream = new StockDataStream();
		this.searchService = new SearchService();
	}

	public getSearchService(): SearchService {
		return this.searchService;
	}

	public getDataStream(): StockDataStream {
		return this.dataStream;
	}

	public async addStock(symbol: string): Promise<void> {
		await this.dataStream.addStock(symbol);
	}

	public start(symbols?: string[]): {
		marketData$: Observable<MarketData>;
		status$: Observable<AppStatus>;
		stocks$: Observable<Stock[]>;
	} {
		if (this.isRunning) {
			return this.getObservables();
		}

		this.isRunning = true;

		if (symbols && symbols.length > 0) {
			this.dataStream.setSymbols(symbols);
		}

		this.dataStream.setLiveUpdatesEnabled(true);
		this.dataStream.setRefreshInterval(60000);

		this.dataStream.start();

		return this.getObservables();
	}

	public stop(): void {
		this.dataStream.stop();
		this.isRunning = false;
	}

	private getObservables() {
		const marketData$ = this.dataStream.marketData$;

		const stocks$ = marketData$.pipe(
			map((data) => data.stocks),
			startWith([])
		);

		const status$ = this.dataStream.status$.pipe(
			map((status) => ({
				...status,
				isRunning: this.isRunning,
				appTitle: "Stock Live Monitor",
			}))
		);

		return {
			marketData$,
			stocks$,
			status$,
		};
	}

	public async refresh(): Promise<void> {
		return this.dataStream.refresh();
	}

	public setRefreshInterval(seconds: number): void {
		this.dataStream.setRefreshInterval(seconds * 1000);
	}

	public getCurrentData(): MarketData | null {
		return this.dataStream.getCurrentData();
	}

	public getStats(): AppStats {
		const currentData = this.getCurrentData();

		if (!currentData) {
			return {
				totalStocks: 0,
				gainers: 0,
				losers: 0,
				totalVolume: "0",
				avgChange: 0,
				sentiment: "NEUTRAL",
			};
		}

		const summary = currentData.getSummary();

		return {
			totalStocks: summary.totalStocks,
			gainers: summary.gainers,
			losers: summary.losers,
			totalVolume: currentData.formattedTotalVolume,
			avgChange: Number(summary.averageChange.toFixed(2)),
			sentiment: summary.sentiment,
		};
	}

	public getTopMovers(count: number = 5): Stock[] {
		const currentData = this.getCurrentData();
		return currentData ? currentData.getTopMovers(count) : [];
	}

	public getSortedStocks(criteria: "symbol" | "price" | "change" | "percentage" | "volume" = "symbol"): Stock[] {
		const currentData = this.getCurrentData();
		return currentData ? currentData.sortBy(criteria) : [];
	}

	public isReady(): boolean {
		return this.isRunning && this.getCurrentData() !== null;
	}
}

export interface AppStatus {
	isLoading: boolean;
	hasError: boolean;
	error: string | null;
	isConnected: boolean;
	lastUpdate: Date | null;
	stockCount: number;
	isRunning: boolean;
	appTitle: string;
}

export interface AppStats {
	totalStocks: number;
	gainers: number;
	losers: number;
	totalVolume: string;
	avgChange: number;
	sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
}
