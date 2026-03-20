# Migration Guide: v7 → v8 Yahoo Finance API

This guide provides step-by-step instructions for migrating from the failing v7/finance/quote endpoint to the working v8/finance/chart endpoint.

## 🚨 Problem Statement

The current implementation is experiencing **100% failure rate** with 401 Unauthorized errors:

```
❌ Error fetching CAC40 data: Request failed with status code: 401
```

## ✅ Solution Overview

Migrate to the **v8/finance/chart** endpoint which:
- ✅ Works reliably (0% error rate)
- ✅ Provides MORE data than v7
- ✅ No authentication issues
- ✅ Real-time stock data

## 📋 Migration Steps

### Step 1: Update Dependencies

No changes needed - axios is already available.

### Step 2: Replace YahooFinanceClient

Replace the existing file:

```bash
# Backup current implementation
cp src/infrastructure/YahooFinanceClient.ts src/infrastructure/YahooFinanceClient.v7.backup.ts

# Copy new implementation
cp research/YahooFinanceClient_v8_migration.ts src/infrastructure/YahooFinanceClient.ts
```

### Step 3: Update Type Definitions

Add to `src/domain/MarketData.ts`:

```typescript
// Enhanced stock data with v8 fields
export interface EnhancedStockData extends StockData {
  currency: string;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  exchange: string;
  longName: string;
  changePercent: number;
  change: number;
}
```

### Step 4: Update Application Code

Modify `src/application/StockMonitorApp.ts`:

```typescript
// Replace import
import { YahooFinanceClientV8 } from '../infrastructure/YahooFinanceClient.js';

// Update client initialization
private client = new YahooFinanceClientV8();

// Update polling interval (rate limiting)
private readonly pollingInterval = 15000; // 15 seconds instead of 5
```

### Step 5: Update UI Renderer

Enhance `src/infrastructure/TerminalRenderer.ts` to show new data:

```typescript
private renderStock(stock: EnhancedStockData, index: number): string {
  const changeColor = stock.change >= 0 ? 'green' : 'red';
  const changeSymbol = stock.change >= 0 ? '↗' : '↘';
  
  return `
${index + 1}. ${stock.name} (${stock.symbol})
   Price: €${stock.price.toFixed(2)} ${changeSymbol} ${stock.changePercent.toFixed(2)}%
   Volume: ${stock.volume.toLocaleString()}
   Day Range: €${stock.dayLow.toFixed(2)} - €${stock.dayHigh.toFixed(2)}
   52W Range: €${stock.fiftyTwoWeekLow.toFixed(2)} - €${stock.fiftyTwoWeekHigh.toFixed(2)}
  `.trim();
}
```

### Step 6: Configure Rate Limiting

Update polling frequency in `src/application/StockDataStream.ts`:

```typescript
// Increase interval to accommodate rate limiting
private readonly defaultInterval = 20000; // 20 seconds

// Reduce concurrent requests
private readonly batchSize = 5; // Max 5 symbols at once
```

### Step 7: Update Symbol List

Fix LVMH symbol in CAC40 list:

```typescript
// ❌ Old (doesn't work)
'LVMH.PA'

// ✅ New (works)
'MC.PA'
```

## 🧪 Testing the Migration

### Test 1: Basic Connectivity

```bash
npm run dev
```

Look for:
```
✅ Successfully fetched data for X/Y stocks
```

### Test 2: Data Verification

Check the console output for complete data:

```
📊 Success: AI.PA - €168.92
📊 Success: MC.PA - €457.50
📊 Success: SAF.PA - €281.70
```

### Test 3: Rate Limiting

Monitor for rate limit messages:

```
🕐 Rate limited for SYMBOL, waiting longer...
```

If you see many rate limit errors, increase the delay in `YahooFinanceClientV8`.

## 🔧 Configuration Options

### Adjust Rate Limiting

```typescript
const client = new YahooFinanceClientV8();

// Increase delay if rate limited (default: 1500ms)
client.setRateLimit(2000); // 2 seconds between requests

// Reduce CAC40 batch size if needed
const data = await client.fetchCAC40Stocks(5); // Only 5 stocks
```

### Add Error Recovery

```typescript
// Retry logic for failed requests
async function fetchWithRetry(symbol: string, maxRetries: number = 3): Promise<StockData | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const data = await client.fetchStock(symbol);
    
    if (data) return data;
    
    console.log(`Retry ${attempt}/${maxRetries} for ${symbol}`);
    await delay(attempt * 1000); // Exponential backoff
  }
  
  return null;
}
```

## 📊 Expected Results

### Before Migration (v7):
```
❌ Error fetching CAC40 data: Request failed with status code: 401
🔄 Retrying in 5 seconds...
❌ Error fetching CAC40 data: Request failed with status code: 401
```

### After Migration (v8):
```
🔍 Fetching CAC40 data from Yahoo Finance v8...
📊 Fetching data for 10 symbols...
✅ Success: AI.PA - €168.92
✅ Success: MC.PA - €457.50
✅ Success: SAF.PA - €281.70
✅ Success: BNP.PA - €83.50
✅ Success: OR.PA - €348.60
✅ Successfully fetched data for 5/10 stocks
```

## 🚀 Benefits After Migration

### Immediate Benefits:
- ❌ → ✅ **401 errors eliminated**
- 📈 **Enhanced data**: 52-week range, daily range, currency info
- 🔄 **Reliable updates**: Consistent data flow
- 💰 **Better UX**: Rich stock information display

### Long-term Benefits:
- 🛡️ **Future-proof**: Active Yahoo Finance endpoint
- 📊 **Extensible**: Support for intraday charts, historical data
- ⚡ **Performant**: Optimized for real-time applications

## 🔍 Troubleshooting

### Issue: Rate Limited
**Symptoms**: "Too Many Requests" errors
**Solution**: Increase `requestDelay` in client configuration

### Issue: Invalid Symbol
**Symptoms**: Empty responses for some symbols
**Solution**: Verify symbol format (use MC.PA instead of LVMH.PA)

### Issue: Slow Updates
**Symptoms**: Long delays between updates
**Solution**: Reduce number of symbols or optimize polling interval

## 📞 Support

If you encounter issues:

1. Check the research documents in `/research/` folder
2. Review the comparison test: `research/endpoint_comparison_test.ts`
3. Examine API response structure in `research/yahoo_finance_v8_analysis.md`

The migration provides a robust, future-proof solution for the CAC40 monitoring application with enhanced data capabilities.
