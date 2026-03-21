import axios, { AxiosResponse } from 'axios';
import { StockData, ApiResponse } from '../domain/index.js';
import { progressTracker } from '../shared/ProgressTracker.js';

/**
 * Yahoo Finance API client for fetching stock data using v8 endpoint with smart batching
 */
export class YahooFinanceClient {
  private readonly baseUrl = 'https://query1.finance.yahoo.com';
  private readonly timeout = 10000; // 10 seconds
  private readonly requestDelay = 800; // 0.8 seconds between requests for reliable fetching
  private readonly batchSize = 8; // Fetch 8 stocks per batch
  private readonly batchDelay = 2000; // 2 seconds between batches

  /**
   * CAC40 constituent symbols (major companies) - Updated with correct symbols
   */
  private readonly cac40Symbols = [
    'AI.PA',     // Air Liquide
    'ALO.PA',    // Alstom
    'MT.AS',     // ArcelorMittal
    'BNP.PA',    // BNP Paribas
    // 'EN.PA',     // Bouygues
    // 'CAP.PA',    // Capgemini
    // 'CA.PA',     // Carrefour
    // 'ACA.PA',    // Crédit Agricole
    // 'BN.PA',     // Danone
    // 'ENGI.PA',   // Engie
    // 'RMS.PA',    // Hermès
    // 'KER.PA',    // Kering
    // 'MC.PA',     // LVMH (Correct symbol)
    // 'OR.PA',     // L'Oréal
    // 'RI.PA',     // Pernod Ricard
    // 'SAF.PA',    // Safran
    // 'SAN.PA',    // Sanofi
    // 'GLE.PA',    // Société Générale
    // 'TTE.PA',    // TotalEnergies (Updated from FP.PA)
    // 'VIV.PA'     // Vivendi
  ];

  /**
   * Test API connection by fetching a single stock
   */
  async testConnection(): Promise<boolean> {
    try {
      const testSymbol = 'AI.PA'; // Use first CAC40 stock for testing
      const data = await this.fetchSingleStock(testSymbol);
      return data !== null;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Fetch stock data for CAC40 stocks using v8/finance/chart endpoint with smart batching
   */
  async fetchCAC40Stocks(): Promise<ApiResponse> {
    try {
      // Use all available stocks (20 stocks)
      const symbols = this.cac40Symbols;
      const stockData: StockData[] = [];

      // Initialize progress tracking
      const batches = this.createBatches(symbols, this.batchSize);
      progressTracker.startTracking(symbols.length, batches.length);
      
      // Process stocks in batches for better performance and reliability
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        
        // Update batch progress
        progressTracker.updateBatch(batchNumber, batch);
        
        // Process stocks in current batch sequentially
        for (const symbol of batch) {
          try {
            // Update current symbol being processed
            progressTracker.updateCurrentSymbol(symbol);
            
            const data = await this.fetchSingleStock(symbol);
            if (data) {
              stockData.push(data);
              progressTracker.addSuccess(symbol);
            } else {
              progressTracker.addError(symbol, 'No data returned from API');
            }
            
            // Add delay between individual requests within batch
            if (symbol !== batch[batch.length - 1]) {
              await this.sleep(this.requestDelay);
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            progressTracker.addError(symbol, errorMessage);
            continue; // Skip failed stocks but continue with others
          }
        }
        
        // Add longer delay between batches (except after the last batch)
        if (batchIndex < batches.length - 1) {
          await this.sleep(this.batchDelay);
        }
      }

      if (stockData.length === 0) {
        throw new Error('No stock data could be fetched from Yahoo Finance API');
      }

      return {
        success: true,
        data: stockData,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        data: [],
        error: `Yahoo Finance API Error: ${errorMessage}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch stock data for a limited number of stocks for testing (first 3)
   */
  async fetchLimitedStocks(): Promise<ApiResponse> {
    try {
      // Use only first 3 stocks for testing
      const symbols = this.cac40Symbols.slice(0, 3);
      const stockData: StockData[] = [];

      // Initialize progress tracking
      const batches = this.createBatches(symbols, this.batchSize);
      progressTracker.startTracking(symbols.length, batches.length);
      
      // Process stocks sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        
        progressTracker.updateBatch(batchNumber, batch);
        
        for (const symbol of batch) {
          try {
            progressTracker.updateCurrentSymbol(symbol);
            
            const data = await this.fetchSingleStock(symbol);
            if (data) {
              stockData.push(data);
              progressTracker.addSuccess(symbol);
            } else {
              progressTracker.addError(symbol, 'No data returned from API');
            }
            
            if (symbol !== batch[batch.length - 1]) {
              await this.sleep(this.requestDelay);
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            progressTracker.addError(symbol, errorMessage);
            continue;
          }
        }
      }

      if (stockData.length === 0) {
        throw new Error('No stock data could be fetched from Yahoo Finance API');
      }

      return {
        success: true,
        data: stockData,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        data: [],
        error: `Yahoo Finance API Error: ${errorMessage}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch data for a single stock using Yahoo Finance v8 chart endpoint
   */
  private async fetchSingleStock(symbol: string): Promise<StockData | null> {
    try {
      const url = `${this.baseUrl}/v8/finance/chart/${symbol}`;
      
      const response: AxiosResponse = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        params: {
          range: '1d',
          interval: '1m',
          includePrePost: false,
          events: 'div,splits'
        }
      });

      // Extract data from v8 endpoint response structure
      const chartData = response.data?.chart?.result?.[0];
      if (!chartData) {
        throw new Error('Invalid response structure from Yahoo Finance');
      }

      const meta = chartData.meta;
      if (!meta) {
        throw new Error('Missing metadata in Yahoo Finance response');
      }

      // Extract current price and calculate changes
      const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
      const previousClose = meta.previousClose || currentPrice;

      // Get volume data
      const volume = meta.regularMarketVolume || 0;

      return {
        symbol: symbol,
        name: meta.longName || meta.shortName || symbol,
        price: currentPrice,
        previousClose: previousClose,
        volume: volume
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
      } else if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`Timeout after ${this.timeout}ms for ${symbol}`);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Network error for ${symbol}: ${errorMessage}`);
      }
    }
  }

  /**
   * Create batches from array of symbols
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}