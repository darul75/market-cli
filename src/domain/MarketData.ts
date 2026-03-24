import { Stock } from './Stock.js';

/**
 * Aggregate representing market data for a collection of stocks
 */
export class MarketData {
  constructor(
    public readonly stocks: Stock[],
    public readonly lastUpdate: Date,
    public readonly isLive: boolean = true,
    public readonly indexName: string = ''
  ) {}

  /**
   * Find a stock by symbol
   */
  getStock(symbol: string): Stock | undefined {
    return this.stocks.find(stock => 
      stock.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  /**
   * Get stocks sorted by percentage change (biggest movers first)
   */
  getTopMovers(count: number = 5): Stock[] {
    return [...this.stocks]
      .sort((a, b) => Math.abs(b.priceChangePercentage) - Math.abs(a.priceChangePercentage))
      .slice(0, count);
  }

  /**
   * Get stocks with positive price changes
   */
  get gainers(): Stock[] {
    return this.stocks.filter(stock => stock.isPositive);
  }

  /**
   * Get stocks with negative price changes
   */
  get losers(): Stock[] {
    return this.stocks.filter(stock => stock.isNegative);
  }

  /**
   * Get average percentage change across all stocks
   */
  get averageChange(): number {
    if (this.stocks.length === 0) return 0;
    const totalChange = this.stocks.reduce(
      (sum, stock) => sum + stock.priceChangePercentage, 
      0
    );
    return totalChange / this.stocks.length;
  }

  /**
   * Get total market volume
   */
  get totalVolume(): number {
    return this.stocks.reduce((sum, stock) => sum + stock.volume, 0);
  }

  /**
   * Format total volume in human readable format
   */
  get formattedTotalVolume(): string {
    const volume = this.totalVolume;
    if (volume >= 1_000_000_000) {
      return `${(volume / 1_000_000_000).toFixed(1)}B`;
    } else if (volume >= 1_000_000) {
      return `${(volume / 1_000_000).toFixed(1)}M`;
    } else if (volume >= 1_000) {
      return `${(volume / 1_000).toFixed(1)}K`;
    }
    return volume.toString();
  }

  /**
   * Get market sentiment based on gainers vs losers ratio
   */
  get marketSentiment(): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const gainersCount = this.gainers.length;
    const losersCount = this.losers.length;
    const ratio = gainersCount / (gainersCount + losersCount);
    
    if (ratio > 0.6) return 'BULLISH';
    if (ratio < 0.4) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Check if all stock data is fresh
   */
  isDataFresh(maxAgeSeconds: number = 30): boolean {
    return this.stocks.every(stock => stock.isDataFresh(maxAgeSeconds));
  }

  /**
   * Get stocks sorted by a specific criteria
   */
  sortBy(criteria: 'symbol' | 'price' | 'change' | 'percentage' | 'volume'): Stock[] {
    const sorted = [...this.stocks];
    
    switch (criteria) {
      case 'symbol':
        return sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
      case 'price':
        return sorted.sort((a, b) => b.price.amount - a.price.amount);
      case 'change':
        return sorted.sort((a, b) => b.priceChange - a.priceChange);
      case 'percentage':
        return sorted.sort((a, b) => b.priceChangePercentage - a.priceChangePercentage);
      case 'volume':
        return sorted.sort((a, b) => b.volume - a.volume);
      default:
        return sorted;
    }
  }

  /**
   * Create new MarketData with updated stocks
   */
  updateStocks(newStocks: Stock[]): MarketData {
    return new MarketData(newStocks, new Date(), this.isLive, this.indexName);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      totalStocks: this.stocks.length,
      gainers: this.gainers.length,
      losers: this.losers.length,
      unchanged: this.stocks.length - this.gainers.length - this.losers.length,
      averageChange: this.averageChange,
      totalVolume: this.totalVolume,
      sentiment: this.marketSentiment,
      lastUpdate: this.lastUpdate,
      isLive: this.isLive
    };
  }
}