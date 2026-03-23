import { StockDataStream } from './StockDataStream.js';
import { MarketData, Stock } from '../domain/index.js';
import { SearchService } from './SearchService.js';
import { Observable, map, startWith } from 'rxjs';

/**
 * Main application service coordinating the stock monitoring functionality
 */
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

  public async addStock(symbol: string, name: string): Promise<void> {
    console.log(`Adding ${symbol} (${name}) to watchlist...`);
    await this.dataStream.addStock(symbol, name);
  }

  /**
   * Start the stock monitoring application
   */
  public start(): {
    marketData$: Observable<MarketData>;
    status$: Observable<AppStatus>;
    stocks$: Observable<Stock[]>;
  } {
    if (this.isRunning) {
      console.log('🏃 Application already running');
      return this.getObservables();
    }

    console.log('🚀 Starting CAC40 Stock Monitor...');
    this.isRunning = true;

    // Configure data stream for live updates with 1-minute refresh
    this.dataStream.setLiveUpdatesEnabled(true);
    this.dataStream.setRefreshInterval(60000); // 1 minute
    console.log('📊 Configured for live updates (1-minute refresh interval)');

    // Start the data stream
    this.dataStream.start();

    return this.getObservables();
  }

  /**
   * Stop the application
   */
  public stop(): void {
    console.log('⏹️ Stopping CAC40 Stock Monitor...');
    this.dataStream.stop();
    this.isRunning = false;
  }

  /**
   * Get reactive observables for UI consumption
   */
  private getObservables() {
    // Transform market data for different UI needs
    const marketData$ = this.dataStream.marketData$;
    
    const stocks$ = marketData$.pipe(
      map(data => data.stocks),
      startWith([])
    );

    const status$ = this.dataStream.status$.pipe(
      map(status => ({
        ...status,
        isRunning: this.isRunning,
        appTitle: 'CAC40 Live Monitor'
      }))
    );

    return {
      marketData$,
      stocks$,
      status$
    };
  }

  /**
   * Force refresh data
   */
  public async refresh(): Promise<void> {
    return this.dataStream.refresh();
  }

  /**
   * Update refresh interval
   */
  public setRefreshInterval(seconds: number): void {
    this.dataStream.setRefreshInterval(seconds * 1000);
  }

  /**
   * Get current data snapshot
   */
  public getCurrentData(): MarketData | null {
    return this.dataStream.getCurrentData();
  }

  /**
   * Get application statistics
   */
  public getStats(): AppStats {
    const currentData = this.getCurrentData();
    
    if (!currentData) {
      return {
        totalStocks: 0,
        gainers: 0,
        losers: 0,
        totalVolume: '0',
        avgChange: 0,
        sentiment: 'NEUTRAL'
      };
    }

    const summary = currentData.getSummary();
    
    return {
      totalStocks: summary.totalStocks,
      gainers: summary.gainers,
      losers: summary.losers,
      totalVolume: currentData.formattedTotalVolume,
      avgChange: Number(summary.averageChange.toFixed(2)),
      sentiment: summary.sentiment
    };
  }

  /**
   * Get top movers (most volatile stocks)
   */
  public getTopMovers(count: number = 5): Stock[] {
    const currentData = this.getCurrentData();
    return currentData ? currentData.getTopMovers(count) : [];
  }

  /**
   * Sort stocks by criteria
   */
  public getSortedStocks(criteria: 'symbol' | 'price' | 'change' | 'percentage' | 'volume' = 'symbol'): Stock[] {
    const currentData = this.getCurrentData();
    return currentData ? currentData.sortBy(criteria) : [];
  }

  /**
   * Check if application is ready
   */
  public isReady(): boolean {
    return this.isRunning && this.getCurrentData() !== null;
  }
}

/**
 * Application status interface
 */
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

/**
 * Application statistics interface  
 */
export interface AppStats {
  totalStocks: number;
  gainers: number;
  losers: number;
  totalVolume: string;
  avgChange: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}