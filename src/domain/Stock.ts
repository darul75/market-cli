import { Price } from './Price.js';

/**
 * Domain entity representing a stock with its market data
 */
export class Stock {
  constructor(
    public readonly symbol: string,
    public readonly name: string,
    public readonly price: Price,
    public readonly previousPrice: Price,
    public readonly volume: number,
    public readonly lastUpdate: Date,
    public readonly marketCap?: number
  ) {
    if (!symbol || symbol.trim().length === 0) {
      throw new Error('Stock symbol cannot be empty');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Stock name cannot be empty');
    }
    if (volume < 0) {
      throw new Error('Volume cannot be negative');
    }
  }

  /**
   * Calculate absolute price change from previous close
   */
  get priceChange(): number {
    return this.price.amount - this.previousPrice.amount;
  }

  /**
   * Calculate percentage change from previous close
   */
  get priceChangePercentage(): number {
    return this.price.calculatePercentageChange(this.previousPrice);
  }

  /**
   * Check if the stock price is moving up
   */
  get isPositive(): boolean {
    return this.priceChange >= 0;
  }

  /**
   * Check if the stock price is moving down
   */
  get isNegative(): boolean {
    return this.priceChange < 0;
  }

  /**
   * Format price change for display with sign
   */
  get formattedPriceChange(): string {
    return this.price.formatChange(this.previousPrice);
  }

  /**
   * Format percentage change for display with sign and %
   */
  get formattedPercentageChange(): string {
    const percentage = this.priceChangePercentage;
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  }

  /**
   * Format volume in human readable format (K, M, B)
   */
  get formattedVolume(): string {
    if (this.volume >= 1_000_000_000) {
      return `${(this.volume / 1_000_000_000).toFixed(1)}B`;
    } else if (this.volume >= 1_000_000) {
      return `${(this.volume / 1_000_000).toFixed(1)}M`;
    } else if (this.volume >= 1_000) {
      return `${(this.volume / 1_000).toFixed(1)}K`;
    }
    return this.volume.toString();
  }

  /**
   * Check if the stock data is stale (older than specified seconds)
   */
  isDataFresh(maxAgeSeconds: number = 30): boolean {
    const ageSeconds = (Date.now() - this.lastUpdate.getTime()) / 1000;
    return ageSeconds <= maxAgeSeconds;
  }

  /**
   * Create a new Stock with updated price information
   */
  updatePrice(newPrice: Price): Stock {
    return new Stock(
      this.symbol,
      this.name,
      newPrice,
      this.price, // Current price becomes previous price
      this.volume,
      new Date(),
      this.marketCap
    );
  }

  /**
   * Create a new Stock with updated volume
   */
  updateVolume(newVolume: number): Stock {
    return new Stock(
      this.symbol,
      this.name,
      this.price,
      this.previousPrice,
      newVolume,
      new Date(),
      this.marketCap
    );
  }

  /**
   * Get risk indicator based on volatility (percentage change)
   */
  getRiskIndicator(): 'LOW' | 'MEDIUM' | 'HIGH' {
    const absChange = Math.abs(this.priceChangePercentage);
    if (absChange < 1) return 'LOW';
    if (absChange < 3) return 'MEDIUM';
    return 'HIGH';
  }
}