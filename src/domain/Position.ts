export interface Purchase {
  id: string;
  date: string;           // YYYY-MM-DD
  qty: number;
  pricePerShare: number;
}

export interface PurchaseWithPL extends Purchase {
  totalCost: number;
  currentValue: number;
  pl: number;
  plPercent: number;
}

export interface Position {
  symbol: string;
  name: string;
  purchases: Purchase[];
}

export interface PositionSummary {
  totalQty: number;
  totalCost: number;
  currentValue: number;
  totalPL: number;
  totalPLPercent: number;
}
