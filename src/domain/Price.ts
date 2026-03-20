/**
 * Value object representing a monetary price
 */
export class Price {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'EUR'
  ) {
    if (amount < 0) {
      throw new Error('Price cannot be negative');
    }
    if (!Number.isFinite(amount)) {
      throw new Error('Price must be a finite number');
    }
  }

  /**
   * Format price for display with currency symbol
   */
  toString(): string {
    const symbol = this.currency === 'EUR' ? '€' : this.currency;
    return `${symbol}${this.amount.toFixed(2)}`;
  }

  /**
   * Format price change for display
   */
  formatChange(previousPrice: Price): string {
    const change = this.amount - previousPrice.amount;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  }

  /**
   * Calculate percentage change from previous price
   */
  calculatePercentageChange(previousPrice: Price): number {
    if (previousPrice.amount === 0) return 0;
    return ((this.amount - previousPrice.amount) / previousPrice.amount) * 100;
  }

  /**
   * Create a new Price with updated amount
   */
  updateAmount(newAmount: number): Price {
    return new Price(newAmount, this.currency);
  }
}