import axios, { AxiosResponse } from 'axios';

// Updated types for v8 endpoint
interface YahooV8ChartResponse {
  chart: {
    result: [{
      meta: {
        symbol: string;
        shortName: string;
        longName: string;
        currency: string;
        regularMarketPrice: number;
        previousClose: number;
        regularMarketVolume: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        exchangeName: string;
        instrumentType: string;
        priceHint: number;
      };
      timestamp: number[];
      indicators: {
        quote: [{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }];
        adjclose?: [{
          adjclose: number[];
        }];
      };
    }];
    error?: any;
  };
}

// Enhanced StockData interface
interface EnhancedStockData {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  volume: number;
  marketCap?: number; // Not available in v8
  // New fields from v8
  currency: string;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  exchange: string;
  longName: string;
  changePercent: number; // Calculated
  change: number; // Calculated
}

interface ApiResponse {
  success: boolean;
  data?: EnhancedStockData[];
  error?: string;
  timestamp: string;
}

/**
 * Updated Yahoo Finance API client using v8/finance/chart endpoint
 * Fixes 401 errors and provides enhanced data
 */
export class YahooFinanceClientV8 {
  private readonly baseUrl = 'https://query1.finance.yahoo.com';
  private readonly timeout = 10000; // 10 seconds
  private readonly requestDelay = 1500; // 1.5 seconds between requests

  /**
   * CAC40 constituent symbols - updated with correct symbols
   */
  private readonly cac40Symbols = [
    'AIR.PA',    // Airbus
    'AI.PA',     // Air Liquide  
    'ALO.PA',    // Alstom
    'MT.PA',     // ArcelorMittal (note: .PA not .AS)
    'CS.PA',     // AXA
    'BNP.PA',    // BNP Paribas
    'EN.PA',     // Bouygues
    'CAP.PA',    // Capgemini
    'CA.PA',     // Carrefour
    'ACA.PA',    // Crédit Agricole
    'BN.PA',     // Danone
    'ENGI.PA',   // Engie
    'EL.PA',     // EssilorLuxottica
    'RMS.PA',    // Hermès
    'KER.PA',    // Kering
    'LR.PA',     // Legrand
    'MC.PA',     // LVMH (note: MC.PA not LVMH.PA)
    'ML.PA',     // Michelin
    'OR.PA',     // L'Oréal
    'RI.PA',     // Pernod Ricard
    'PUB.PA',    // Publicis
    'RNO.PA',    // Renault
    'SAF.PA',    // Safran
    'SAN.PA',    // Sanofi
    'SU.PA',     // Schneider Electric
    'GLE.PA',    // Société Générale
    'STM.PA',    // STMicroelectronics
    'TEP.PA',    // Teleperformance
    'HO.PA',     // Thales
    'FP.PA',     // TotalEnergies
    'URW.AS',    // Unibail-Rodamco-Westfield
    'VIE.PA',    // Veolia
    'DG.PA',     // Vinci
    'VIV.PA',    // Vivendi
    'WLN.PA'     // Worldline
  ];

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract stock data from v8 chart response
   */
  private extractStockData(response: YahooV8ChartResponse): EnhancedStockData {
    const result = response.chart.result[0];
    const meta = result.meta;

    const price = meta.regularMarketPrice || 0;
    const previousClose = meta.previousClose || 0;
    const change = price - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: meta.symbol || 'N/A',
      name: meta.shortName || meta.symbol || 'Unknown',
      longName: meta.longName || meta.shortName || 'Unknown',
      price,
      previousClose,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency || 'EUR',
      dayHigh: meta.regularMarketDayHigh || 0,
      dayLow: meta.regularMarketDayLow || 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
      exchange: meta.exchangeName || 'PAR',
      change,
      changePercent
    };
  }

  /**
   * Fetch data for a single stock symbol
   */
  async fetchStock(symbol: string): Promise<EnhancedStockData | null> {
    try {
      const url = `${this.baseUrl}/v8/finance/chart/${symbol}`;
      const params = {
        interval: '1d',
        range: '1d'
      };

      console.log(`📊 Fetching data for ${symbol}...`);

      const response: AxiosResponse<YahooV8ChartResponse> = await axios.get(url, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.data?.chart?.result?.[0]?.meta) {
        throw new Error('Invalid response format from Yahoo Finance');
      }

      if (response.data.chart.error) {
        throw new Error(`Yahoo Finance API error: ${JSON.stringify(response.data.chart.error)}`);
      }

      return this.extractStockData(response.data);

    } catch (error) {
      console.error(`❌ Error fetching data for ${symbol}:`, error);
      
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log(`🕐 Rate limited for ${symbol}, waiting longer...`);
        await this.delay(5000); // Wait 5 seconds for rate limit
        return null; // Caller should retry
      }
      
      return null;
    }
  }

  /**
   * Fetch data for multiple stock symbols with rate limiting
   */
  async fetchStocks(symbols: string[]): Promise<ApiResponse> {
    try {
      if (symbols.length === 0) {
        throw new Error('No symbols provided');
      }

      console.log(`🔍 Fetching data for ${symbols.length} symbols...`);
      const stockData: EnhancedStockData[] = [];
      const failures: string[] = [];

      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const data = await this.fetchStock(symbol);
        
        if (data) {
          stockData.push(data);
          console.log(`✅ Success: ${symbol} - €${data.price.toFixed(2)}`);
        } else {
          failures.push(symbol);
          console.log(`❌ Failed: ${symbol}`);
        }

        // Rate limiting: wait between requests (except for last request)
        if (i < symbols.length - 1) {
          await this.delay(this.requestDelay);
        }
      }

      if (failures.length > 0) {
        console.log(`⚠️  Failed to fetch data for: ${failures.join(', ')}`);
      }

      console.log(`✅ Successfully fetched data for ${stockData.length}/${symbols.length} stocks`);

      return {
        success: stockData.length > 0,
        data: stockData,
        error: failures.length > 0 ? `Failed to fetch: ${failures.join(', ')}` : undefined,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error fetching stocks data:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch CAC40 stocks with enhanced data
   */
  async fetchCAC40Stocks(limit: number = 10): Promise<ApiResponse> {
    try {
      console.log('🔍 Fetching CAC40 data from Yahoo Finance v8...');
      
      // Take first N stocks to avoid rate limits
      const symbols = this.cac40Symbols.slice(0, limit);
      
      return await this.fetchStocks(symbols);

    } catch (error) {
      console.error('❌ Error fetching CAC40 data:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get all available CAC40 symbols
   */
  getCAC40Symbols(): string[] {
    return [...this.cac40Symbols];
  }

  /**
   * Test API connectivity with a single stock
   */
  async testConnection(): Promise<boolean> {
    try {
      const testSymbol = 'AI.PA'; // Air Liquide - reliable test stock
      const data = await this.fetchStock(testSymbol);
      return data !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get current rate limit delay
   */
  getRateLimit(): number {
    return this.requestDelay;
  }

  /**
   * Set rate limit delay (useful for adjusting based on API behavior)
   */
  setRateLimit(delayMs: number): void {
    if (delayMs >= 500) { // Minimum 500ms
      this.requestDelay = delayMs;
    }
  }
}

// Usage example:
/*
const client = new YahooFinanceClientV8();

// Test single stock
const airLiquide = await client.fetchStock('AI.PA');
console.log(airLiquide);

// Test multiple stocks
const result = await client.fetchStocks(['AI.PA', 'MC.PA', 'SAF.PA']);
console.log(result);

// Test CAC40 subset
const cac40Data = await client.fetchCAC40Stocks(5);
console.log(cac40Data);
*/
