// Domain exports
export { Price } from './Price.js';
export { Stock } from './Stock.js';
export { MarketData } from './MarketData.js';

// Domain types
export interface StockData {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  volume: number;
  marketCap?: number;
}

export interface ApiResponse {
  success: boolean;
  data?: StockData[];
  error?: string;
  timestamp: string;
}

export type SortCriteria = 'symbol' | 'price' | 'change' | 'percentage' | 'volume';
export type MarketSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type RiskIndicator = 'LOW' | 'MEDIUM' | 'HIGH';