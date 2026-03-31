import type { Price } from "./Price.js";

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
			throw new Error("Stock symbol cannot be empty");
		}
		if (!name || name.trim().length === 0) {
			throw new Error("Stock name cannot be empty");
		}
		if (volume < 0) {
			throw new Error("Volume cannot be negative");
		}
	}

	get priceChange(): number {
		return this.price.amount - this.previousPrice.amount;
	}

	get priceChangePercentage(): number {
		return this.price.calculatePercentageChange(this.previousPrice);
	}

	get isPositive(): boolean {
		return this.priceChange >= 0;
	}

	get isNegative(): boolean {
		return this.priceChange < 0;
	}

	get formattedPriceChange(): string {
		return this.price.formatChange(this.previousPrice);
	}

	get formattedPercentageChange(): string {
		const percentage = this.priceChangePercentage;
		const sign = percentage >= 0 ? "+" : "";
		return `${sign}${percentage.toFixed(2)}%`;
	}

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

	isDataFresh(maxAgeSeconds: number = 30): boolean {
		const ageSeconds = (Date.now() - this.lastUpdate.getTime()) / 1000;
		return ageSeconds <= maxAgeSeconds;
	}

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

	updateVolume(newVolume: number): Stock {
		return new Stock(this.symbol, this.name, this.price, this.previousPrice, newVolume, new Date(), this.marketCap);
	}

	getRiskIndicator(): "LOW" | "MEDIUM" | "HIGH" {
		const absChange = Math.abs(this.priceChangePercentage);
		if (absChange < 1) return "LOW";
		if (absChange < 3) return "MEDIUM";
		return "HIGH";
	}
}
