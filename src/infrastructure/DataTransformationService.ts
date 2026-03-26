import { Stock, Price, MarketData, StockData } from '../domain/index.js';

/**
 * Service to transform external API data into domain objects
 */
export class DataTransformationService {
  
  /**
   * Transform API stock data array into domain Stock objects
   */
  transformToStocks(stockDataArray: StockData[]): Stock[] {
    return stockDataArray
      .filter(this.isValidStockData)
      .map((data) => this.transformToStock(data));
  }

  /**
   * Transform API stock data array into MarketData aggregate
   */
  transformToMarketData(stockDataArray: StockData[], indexName: string = 'CAC40'): MarketData {
    const stocks = this.transformToStocks(stockDataArray);
    
    if (stocks.length === 0) {
      throw new Error('No valid stock data to create MarketData');
    }

    return new MarketData(
      stocks,
      new Date(),
      true, // isLive
      indexName
    );
  }

  /**
   * Transform single stock data to domain Stock object
   */
  public transformToStock(stockData: StockData): Stock {
    const currency = stockData.currency || 'USD';
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
  };

  /**
   * Validate that stock data has required fields
   */
  private isValidStockData = (stockData: StockData): boolean => {
    return !!(
      stockData.symbol &&
      stockData.name &&
      typeof stockData.price === 'number' &&
      stockData.price > 0 &&
      typeof stockData.previousClose === 'number' &&
      stockData.previousClose > 0 &&
      typeof stockData.volume === 'number' &&
      stockData.volume >= 0
    );
  };

  /**
   * Clean and format company names
   */
  private cleanCompanyName(name: string): string {
    return name
      .replace(/\s*(SA|SE|NV|PLC|Ltd|Inc|Corp)\.?\s*$/i, '')  // Remove company suffixes
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
  }

  /**
   * Merge new stock data with existing stocks, updating prices
   */
  updateMarketData(currentMarketData: MarketData, newStockData: StockData[]): MarketData {
    const stockMap = new Map(
      currentMarketData.stocks.map(stock => [stock.symbol, stock])
    );

    // Update existing stocks or add new ones
    const updatedStocks = newStockData
      .filter(this.isValidStockData)
      .map(stockData => {
        const existingStock = stockMap.get(stockData.symbol);
        
        if (existingStock) {
          // Update existing stock with new price data
          const currency = stockData.currency || 'USD';
          const newPrice = new Price(stockData.price, currency);
          return existingStock.updatePrice(newPrice).updateVolume(stockData.volume);
        } else {
          // Create new stock
          return this.transformToStock(stockData);
        }
      });

    // Add stocks that weren't in the new data (keep existing)
    currentMarketData.stocks.forEach(stock => {
      const wasUpdated = newStockData.some(data => data.symbol === stock.symbol);
      if (!wasUpdated) {
        updatedStocks.push(stock);
      }
    });

    return currentMarketData.updateStocks(updatedStocks);
  }
}