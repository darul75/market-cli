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
  concat
} from 'rxjs';
import { MarketData } from '../domain/index.js';
import { YahooFinanceClient } from '../infrastructure/YahooFinanceClient.js';
import { DataTransformationService } from '../infrastructure/DataTransformationService.js';

/**
 * Application service managing reactive stock data streams
 */
export class StockDataStream {
  private readonly apiClient: YahooFinanceClient;
  private readonly transformationService: DataTransformationService;
  
  // Internal state subjects
  private readonly marketDataSubject = new BehaviorSubject<MarketData | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);

  // Track all symbols (original + added dynamically) to ensure they're preserved during refresh
  private trackedSymbols = new Set<string>();

  // Configuration
  private refreshIntervalMs: number = 60000; // 1 minute for live updates
  private isStarted: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private initialLoadComplete: boolean = false;
  private enableLiveUpdates: boolean = true; // Set to false to load once and stop

  constructor() {
    this.apiClient = new YahooFinanceClient();
    this.transformationService = new DataTransformationService();
  }

  /**
   * Set symbols to fetch on next start
   */
  public setSymbols(symbols: string[]): void {
    this.apiClient.symbols = symbols;
    this.trackedSymbols = new Set(symbols);
  }

  /**
   * Observable for market data updates
   */
  public get marketData$(): Observable<MarketData> {
    return this.marketDataSubject.asObservable().pipe(
      filter((data): data is MarketData => data !== null),
      distinctUntilChanged((prev, curr) => 
        prev.lastUpdate.getTime() === curr.lastUpdate.getTime()
      )
    );
  }

  /**
   * Observable for loading state
   */
  public get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Observable for error state
   */
  public get error$(): Observable<string | null> {
    return this.errorSubject.asObservable();
  }

  /**
   * Observable for connection status
   */
  public get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

   /**
    * Observable that provides app status summary
    */
   public get status$(): Observable<{
     isLoading: boolean;
     hasError: boolean;
     error: string | null;
     isConnected: boolean;
     lastUpdate: Date | null;
     stockCount: number;
   }> {
     return new Observable(subscriber => {
       // Subscribe to all status changes
       const loadingSubscription = this.loadingSubject.subscribe();
       const errorSubscription = this.errorSubject.subscribe();
       const connectionSubscription = this.connectionStatusSubject.subscribe();
       const marketDataSubscription = this.marketDataSubject.subscribe();
       
       // Emit status whenever any status changes
       const emitStatus = () => {
         const marketData = this.marketDataSubject.value;
         subscriber.next({
           isLoading: this.loadingSubject.value,
           hasError: this.errorSubject.value !== null,
           error: this.errorSubject.value,
           isConnected: this.connectionStatusSubject.value,
           lastUpdate: marketData?.lastUpdate || null,
           stockCount: marketData?.stocks.length || 0
         });
       };

       // Subscribe to all changes
       this.loadingSubject.subscribe(emitStatus);
       this.errorSubject.subscribe(emitStatus);
       this.connectionStatusSubject.subscribe(emitStatus);
       this.marketDataSubject.subscribe(emitStatus);

       // Emit initial status
       emitStatus();

       return () => {
         loadingSubscription.unsubscribe();
         errorSubscription.unsubscribe();
         connectionSubscription.unsubscribe();
         marketDataSubscription.unsubscribe();
       };
     });
   }

  /**
   * Start the reactive data stream with better error handling
   */
  public start(): Observable<MarketData> {
    if (this.isStarted) {
      console.log('📊 Data stream already started');
      return this.marketData$;
    }

    console.log('🚀 Starting stock data stream...');
    this.isStarted = true;
    this.retryCount = 0;
    this.initialLoadComplete = false;

    if (this.apiClient.symbols.length === 0) {
      console.log('📭 No symbols configured, emitting empty market data');
      const { Stock } = require('../domain/index.js');
      const emptyMarketData = new (require('../domain/index.js').MarketData)([], new Date(), true, '');
      this.marketDataSubject.next(emptyMarketData);
      this.loadingSubject.next(false);
      this.connectionStatusSubject.next(true);
      return this.marketData$;
    }
    
    // Test connection first, but don't let it block the main data stream
    this.testConnection().catch(error => {
      console.warn('⚠️ Initial connection test failed, but continuing with main data fetch:', error.message);
    });

    // Create initial load stream
    const initialLoad$ = of(0).pipe(
      tap(() => {
        console.log('📊 Performing initial data load...');
        this.loadingSubject.next(true);
        this.errorSubject.next(null);
      }),
      switchMap(() => this.fetchMarketData()),
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to fetch data');
        }
        this.retryCount = 0;
        this.initialLoadComplete = true;
        console.log('✅ Initial data load completed successfully');
        const marketData = this.transformationService.transformToMarketData(response.data);
        console.log(`[STREAM] Transformed to MarketData with ${marketData.stocks.length} stocks`);
        return marketData;
      }),
      tap(() => {
        this.loadingSubject.next(false);
        this.connectionStatusSubject.next(true);
      }),
      catchError(error => {
        console.error('🔥 Initial load error:', error);
        this.loadingSubject.next(false);
        this.errorSubject.next(error.message);
        this.connectionStatusSubject.next(false);
        
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
          console.error(`❌ Max retries (${this.maxRetries}) reached. Stopping stream.`);
          this.isStarted = false;
          return of(null);
        } else {
          console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries}...`);
          // Return EMPTY to skip this cycle but allow retry
          return EMPTY;
        }
      }),
      filter((data): data is MarketData => data !== null)
    );

    // Create live updates stream (only if enabled and initial load successful)
    const liveUpdates$ = this.enableLiveUpdates ? 
      interval(this.refreshIntervalMs).pipe(
        filter(() => this.initialLoadComplete), // Only start after initial load
        tap(() => {
          console.log('🔄 Performing live update...');
          this.loadingSubject.next(true);
          this.errorSubject.next(null);
        }),
        switchMap(() => this.fetchMarketData()),
        map((response: any) => {
          // Build merged data to ensure ALL tracked symbols are present
          const previousData = this.marketDataSubject.value;
          const fetchedSymbols = new Set(response.data?.map((d: any) => d.symbol) || []);
          const previousStocksMap = new Map(
            (previousData?.stocks || []).map(s => [s.symbol, s])
          );
          
          // Start with freshly fetched data
          const mergedStocks = [...(response.data || [])].map(d => {
            const stock = this.transformationService.transformToStock(d);
            return stock;
          });
          
          // For each tracked symbol, ensure it's in the result
          let missingCount = 0;
          for (const symbol of this.trackedSymbols) {
            if (!fetchedSymbols.has(symbol)) {
              // Check if we have it from previous data
              const previousStock = previousStocksMap.get(symbol);
              if (previousStock) {
                mergedStocks.push(previousStock);
                console.log(`  ↩️ ${symbol}: keeping cached price (${previousStock.price.amount})`);
                missingCount++;
              } else {
                // Symbol is tracked but never successfully fetched - try one more time
                console.log(`  ⚠️ ${symbol}: no cached data, attempting fetch...`);
                // Note: We'll handle this asynchronously in a follow-up
              }
            }
          }
          
          if (missingCount > 0) {
            console.log(`⚠️ ${missingCount} stocks restored from cache`);
          }
          
          // Handle completely missing stocks (never fetched successfully)
          // These are tracked symbols that have no cached data
          const mergedSymbols = new Set(mergedStocks.map(s => s.symbol));
          for (const symbol of this.trackedSymbols) {
            if (!mergedSymbols.has(symbol)) {
              console.log(`  🔄 ${symbol}: will be fetched on next refresh`);
            }
          }
          
          // Even if API returned no data, use cached data for tracked symbols
          if (mergedStocks.length === 0 && previousData && previousData.stocks.length > 0) {
            console.log('⚠️ API returned no data, using full cache');
            return previousData;
          }
          
          return this.transformationService.transformToMarketData(
            mergedStocks.map(s => ({
              symbol: s.symbol,
              name: s.name,
              price: s.price.amount,
              previousClose: s.previousPrice.amount,
              volume: s.volume
            }))
          );
        }),
        tap(() => {
          this.loadingSubject.next(false);
          this.connectionStatusSubject.next(true);
        }),
        catchError(error => {
          console.error('🔥 Live update error:', error);
          this.loadingSubject.next(false);
          this.errorSubject.next(error.message);
          // Don't stop the stream for live update errors, just continue
          return EMPTY;
        })
      ) : EMPTY;

    // Combine initial load and live updates
    const combinedStream$ = concat(initialLoad$, liveUpdates$);

    // Subscribe and update the behavior subject
    combinedStream$.subscribe({
      next: (marketData: MarketData) => {
        this.marketDataSubject.next(marketData);
      },
      error: (error: any) => {
        console.error('💥 Fatal data stream error:', error);
        this.isStarted = false;
        this.errorSubject.next(`Fatal error: ${error.message}`);
      }
    });

    return this.marketData$;
  }

  /**
   * Configure live updates
   */
  public setLiveUpdatesEnabled(enabled: boolean): void {
    this.enableLiveUpdates = enabled;
    console.log(`🔧 Live updates ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Stop the data stream
   */
  public stop(): void {
    console.log('⏹️ Stopping stock data stream...');
    this.isStarted = false;
    this.loadingSubject.next(false);
    this.connectionStatusSubject.next(false);
  }

  /**
   * Update refresh interval
   */
  public setRefreshInterval(intervalMs: number): void {
    if (intervalMs < 1000) {
      throw new Error('Refresh interval must be at least 1 second');
    }
    this.refreshIntervalMs = intervalMs;
    console.log(`⏱️ Refresh interval updated to ${intervalMs}ms`);
  }

  /**
   * Get current market data snapshot
   */
  public getCurrentData(): MarketData | null {
    return this.marketDataSubject.value;
  }

  /**
   * Add a new stock to the market data
   */
  public async addStock(symbol: string, name: string): Promise<void> {
    const currentData = this.marketDataSubject.value;
    if (!currentData) {
      throw new Error('No market data available');
    }

    try {
      const stockData = await this.apiClient.fetchSingleStock(symbol);
      if (stockData) {
        const stock = this.transformationService.transformToStock(stockData);
        // Create new array to ensure proper reactivity
        const updatedStocks = [...currentData.stocks, stock];
        this.marketDataSubject.next(currentData.updateStocks(updatedStocks));
        // Track this symbol so it's preserved during refresh
        this.trackedSymbols.add(symbol);
        console.log(`📊 Added ${symbol} to tracked symbols (${this.trackedSymbols.size} total)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to add stock ${symbol}: ${errorMessage}`);
    }
  }

  /**
   * Force refresh market data
   */
  public async refresh(): Promise<void> {
    console.log('🔄 Force refreshing market data...');
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    try {
      const response = await this.fetchMarketData();
      if (response.success && response.data) {
        const marketData = this.transformationService.transformToMarketData(response.data);
        this.marketDataSubject.next(marketData);
        this.connectionStatusSubject.next(true);
      } else {
        throw new Error(response.error || 'Failed to fetch data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errorSubject.next(errorMessage);
      this.connectionStatusSubject.next(false);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Test API connection
   */
  private async testConnection(): Promise<void> {
    try {
      const isConnected = await this.apiClient.testConnection();
      this.connectionStatusSubject.next(isConnected);
      
      if (isConnected) {
        console.log('✅ API connection successful');
      } else {
        console.log('❌ API connection failed');
      }
    } catch (error) {
      console.error('🔌 Connection test failed:', error);
      this.connectionStatusSubject.next(false);
    }
  }

  /**
   * Fetch market data using the Yahoo Finance API
   */
  private async fetchMarketData(): Promise<any> {
    console.log('🔍 DEBUG: fetchMarketData() called');
    try {
      const response = await this.apiClient.fetchStocks();
      console.log('📊 DEBUG: API response received:', response.success ? 'SUCCESS' : 'FAILED');
      if (response.success) {
        console.log(`📈 DEBUG: Fetched ${response.data?.length} stocks successfully`);
      } else {
        console.log('❌ DEBUG: API response error:', response.error);
      }
      return response;
    } catch (error) {
      console.error('❌ DEBUG: fetchMarketData() error:', error);
      throw error;
    }
  }
}