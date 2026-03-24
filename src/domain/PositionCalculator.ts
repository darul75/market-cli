import { Transaction, TransactionWithPL, PositionSummary } from './Position.js';

export function calculateTransactionPL(transaction: Transaction, currentPrice: number): TransactionWithPL {
  const totalCost = transaction.qty * transaction.pricePerShare;
  const currentValue = transaction.type === 'BUY' 
    ? transaction.qty * currentPrice 
    : transaction.qty * currentPrice;
  const pl = currentValue - totalCost;
  const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;
  
  return {
    ...transaction,
    totalCost,
    currentValue,
    pl,
    plPercent
  };
}

export function calculatePositionSummary(
  transactions: Transaction[], 
  currentPrice: number
): PositionSummary {
  const buys: Transaction[] = [];
  const sells: Transaction[] = [];
  
  for (const t of transactions) {
    if (t.type === 'BUY') {
      buys.push(t);
    } else {
      sells.push(t);
    }
  }
  
  // Calculate current holdings using FIFO
  let currentQty = 0;
  let totalInvested = 0;
  const remainingBuys = [...buys];
  
  for (const sell of sells) {
    let remainingSellQty = sell.qty;
    while (remainingSellQty > 0 && remainingBuys.length > 0) {
      const buy = remainingBuys[0];
      if (buy.qty <= remainingSellQty) {
        remainingSellQty -= buy.qty;
        remainingBuys.shift();
      } else {
        const usedBuyQty = remainingSellQty;
        remainingBuys[0] = { ...buy, qty: buy.qty - usedBuyQty };
        remainingSellQty = 0;
      }
    }
  }
  
  for (const buy of remainingBuys) {
    currentQty += buy.qty;
    totalInvested += buy.qty * buy.pricePerShare;
  }
  
  // Calculate realized P&L from sells
  let realizedPL = 0;
  const buysForFIFO = [...buys];
  
  for (const sell of sells) {
    let remainingSellQty = sell.qty;
    while (remainingSellQty > 0 && buysForFIFO.length > 0) {
      const buy = buysForFIFO[0];
      const usedQty = Math.min(buy.qty, remainingSellQty);
      realizedPL += usedQty * (sell.pricePerShare - buy.pricePerShare);
      remainingSellQty -= usedQty;
      
      if (buy.qty <= usedQty) {
        buysForFIFO.shift();
      } else {
        buysForFIFO[0] = { ...buy, qty: buy.qty - usedQty };
      }
    }
  }
  
  const avgCost = currentQty > 0 ? totalInvested / currentQty : 0;
  const currentValue = currentQty * currentPrice;
  const unrealizedPL = currentValue - totalInvested;
  const unrealizedPLPercent = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;
  
  return {
    qty: currentQty,
    totalInvested,
    avgCost,
    currentValue,
    unrealizedPL,
    unrealizedPLPercent,
    realizedPL
  };
}

export function calculateTransactionsWithPL(
  transactions: Transaction[], 
  currentPrice: number
): TransactionWithPL[] {
  return transactions.map(t => calculateTransactionPL(t, currentPrice));
}
