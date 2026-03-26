export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;           // YYYY-MM-DD
  qty: number;
  pricePerShare: number;
  currency: string;        // stock's native currency from Yahoo (EUR, USD, etc.)
}

export interface TransactionWithPL extends Transaction {
  totalCost: number;
  currentValue: number;
  pl: number;
  plPercent: number;
}

export interface Position {
  symbol: string;
  name: string;
  transactions: Transaction[];
}

export interface PositionSummary {
  qty: number;
  totalInvested: number;
  avgCost: number;
  currentValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  realizedPL: number;
}
