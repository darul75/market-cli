import { MarketData, Price, Stock, type StockData } from "../domain/index.js";

export class DataTransformationService {
	transformToStocks(stockDataArray: StockData[]): Stock[] {
		return stockDataArray.filter(this.isValidStockData).map((data) => this.transformToStock(data));
	}

	transformToMarketData(stockDataArray: StockData[], indexName: string = "CAC40"): MarketData {
		const stocks = this.transformToStocks(stockDataArray);

		if (stocks.length === 0) {
			throw new Error("No valid stock data to create MarketData");
		}

		return new MarketData(stocks, new Date(), true, indexName);
	}

	public transformToStock(stockData: StockData): Stock {
		const currency = stockData.currency || "USD";
		const currentPrice = new Price(stockData.price, currency);
		const previousPrice = new Price(stockData.previousClose, currency);

		return new Stock(
			stockData.symbol,
			this.cleanCompanyName(stockData.name),
			currentPrice,
			previousPrice,
			stockData.volume,
			new Date(),
			stockData.marketCap
		);
	}

	private isValidStockData = (stockData: StockData): boolean => {
		return !!(
			stockData.symbol &&
			stockData.name &&
			typeof stockData.price === "number" &&
			stockData.price > 0 &&
			typeof stockData.previousClose === "number" &&
			stockData.previousClose > 0 &&
			typeof stockData.volume === "number" &&
			stockData.volume >= 0
		);
	};

	private cleanCompanyName(name: string): string {
		return name
			.replace(/\s*(SA|SE|NV|PLC|Ltd|Inc|Corp)\.?\s*$/i, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	updateMarketData(currentMarketData: MarketData, newStockData: StockData[]): MarketData {
		const stockMap = new Map(currentMarketData.stocks.map((stock) => [stock.symbol, stock]));

		const updatedStocks = newStockData.filter(this.isValidStockData).map((stockData) => {
			const existingStock = stockMap.get(stockData.symbol);

			if (existingStock) {
				const currency = stockData.currency || "USD";
				const newPrice = new Price(stockData.price, currency);
				return existingStock.updatePrice(newPrice).updateVolume(stockData.volume);
			} else {
				return this.transformToStock(stockData);
			}
		});

		currentMarketData.stocks.forEach((stock) => {
			const wasUpdated = newStockData.some((data) => data.symbol === stock.symbol);
			if (!wasUpdated) {
				updatedStocks.push(stock);
			}
		});

		return currentMarketData.updateStocks(updatedStocks);
	}
}
