import { Purchase, PurchaseWithPL } from './Position.js';

export function calculatePurchasePL(purchase: Purchase, currentPrice: number): PurchaseWithPL {
  const totalCost = purchase.qty * purchase.pricePerShare;
  const currentValue = purchase.qty * currentPrice;
  const pl = currentValue - totalCost;
  const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;
  
  return {
    ...purchase,
    totalCost,
    currentValue,
    pl,
    plPercent
  };
}

export interface PositionSummary {
  qty: number;
  totalCost: number;
  currentValue: number;
  pl: number;
  plPercent: number;
}

export function calculatePositionSummary(
  purchases: Purchase[], 
  currentPrice: number
): PositionSummary {
  let qty = 0;
  let totalCost = 0;
  
  for (const purchase of purchases) {
    qty += purchase.qty;
    totalCost += purchase.qty * purchase.pricePerShare;
  }
  
  const currentValue = qty * currentPrice;
  const pl = currentValue - totalCost;
  const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;
  
  return {
    qty,
    totalCost,
    currentValue,
    pl,
    plPercent
  };
}

export function calculatePurchasesWithPL(
  purchases: Purchase[], 
  currentPrice: number
): PurchaseWithPL[] {
  return purchases.map(p => calculatePurchasePL(p, currentPrice));
}
