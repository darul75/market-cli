import { YahooFinanceClient } from './YahooFinanceClient.js';

export class HistoricalPriceService {
  private apiClient: YahooFinanceClient;
  private cache: Map<string, number> = new Map();

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

  clearCache(): void {
    this.cache.clear();
  }
}
