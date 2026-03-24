import { YahooFinanceClient } from './YahooFinanceClient.js';

export interface PricePoint {
  date: string;
  price: number;
}

export class HistoricalPriceService {
  private apiClient: YahooFinanceClient;
  private cache: Map<string, number> = new Map();
  private rangeCache: Map<string, PricePoint[]> = new Map();

  constructor(apiClient?: YahooFinanceClient) {
    this.apiClient = apiClient || new YahooFinanceClient();
  }

  async getPriceOnDate(symbol: string, date: string): Promise<number | null> {
    const cacheKey = `${symbol}:${date}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    const price = await this.apiClient.fetchHistoricalPrice(symbol, date);
    
    if (price !== null) {
      this.cache.set(cacheKey, price);
    }

    return price;
  }

  async getPriceHistory(symbol: string, range: '1d' | '5d' | '1mo' | '6mo' | 'ytd' | '1y' | '5y' | 'max'): Promise<PricePoint[]> {
    const cacheKey = `${symbol}:${range}`;
    
    if (this.rangeCache.has(cacheKey)) {
      return this.rangeCache.get(cacheKey) || [];
    }

    let interval: string;
    if (range === '1d') {
      interval = '5m';
    } else if (range === '5d' || range === '1mo' || range === 'ytd') {
      interval = '1d';
    } else if (range === '6mo' || range === '1y') {
      interval = '1wk';
    } else {
      interval = '1mo';
    }

    const priceHistory = await this.apiClient.fetchPriceHistory(symbol, range, interval);
    
    if (priceHistory.length > 0) {
      this.rangeCache.set(cacheKey, priceHistory);
    }

    return priceHistory;
  }

  clearCache(): void {
    this.cache.clear();
    this.rangeCache.clear();
  }
}
