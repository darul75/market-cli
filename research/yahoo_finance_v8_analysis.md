# Yahoo Finance v8/finance/chart Endpoint Research

## Executive Summary

The Yahoo Finance v7/finance/quote endpoint is experiencing widespread 401 Unauthorized errors, while the v8/finance/chart endpoint is working reliably and provides comprehensive stock data suitable for replacing the v7 endpoint.

## Key Findings

### 1. Endpoint Reliability

| Endpoint | Status | Error Rate |
|----------|--------|------------|
| v7/finance/quote | ❌ Failing | 100% (401 Unauthorized) |
| v8/finance/chart | ✅ Working | 0% (when rate limited properly) |

### 2. Data Structure Comparison

#### v7/finance/quote Response (When Working)
```json
{
  "quoteResponse": {
    "result": [{
      "symbol": "AI.PA",
      "shortName": "AIR LIQUIDE",
      "regularMarketPrice": 168.92,
      "previousClose": 168.28,
      "regularMarketVolume": 949704,
      "marketCap": 98000000000
    }]
  }
}
```

#### v8/finance/chart Response
```json
{
  "chart": {
    "result": [{
      "meta": {
        "symbol": "AI.PA",
        "shortName": "AIR LIQUIDE", 
        "longName": "L'Air Liquide S.A.",
        "currency": "EUR",
        "regularMarketPrice": 168.92,
        "previousClose": 168.28,
        "regularMarketVolume": 949704,
        "fiftyTwoWeekHigh": 187.12,
        "fiftyTwoWeekLow": 154.86,
        "regularMarketDayHigh": 170.18,
        "regularMarketDayLow": 167.96
      },
      "timestamp": [1774016492],
      "indicators": {
        "quote": [{
          "open": [168.54],
          "high": [170.18],
          "low": [167.96],
          "close": [168.96],
          "volume": [950648]
        }]
      }
    }]
  }
}
```

### 3. CAC40 Symbol Testing Results

| Symbol | Company | v7 Status | v8 Status | Notes |
|--------|---------|-----------|-----------|-------|
| AI.PA | Air Liquide | ❌ 401 | ✅ Working | Complete data available |
| SAF.PA | Safran | ❌ 401 | ✅ Working | Complete data available |
| MC.PA | LVMH | ❌ 401 | ✅ Working | Note: Use MC.PA instead of LVMH.PA |
| BNP.PA | BNP Paribas | ❌ 401 | ✅ Working | Complete data available |
| OR.PA | L'Oréal | ❌ 401 | ✅ Working | Complete data available |

### 4. Rate Limiting Behavior

- **Concurrent Requests**: Blocked with "Too Many Requests" error
- **Sequential Requests**: Work fine with proper delays (1-2 seconds)
- **User-Agent Required**: Must include browser User-Agent header
- **Recommended Approach**: Sequential requests with 1-2 second delays

### 5. Data Advantages of v8 Endpoint

The v8/finance/chart endpoint provides **MORE** data than v7:

#### Additional Fields Available:
- `longName`: Full company name
- `currency`: Trading currency
- `fiftyTwoWeekHigh/Low`: 52-week range
- `regularMarketDayHigh/Low`: Daily range
- `exchangeName`: Exchange information
- `chartPreviousClose`: Previous close (same as previousClose)

#### Time Series Data:
- Intraday price data (1-minute intervals)
- Historical OHLCV data
- Adjustable time ranges (1d, 5d, 1mo, 3mo, 6mo, 1y, etc.)

## Implementation Recommendations

### 1. API Endpoint Migration

**From:**
```
https://query1.finance.yahoo.com/v7/finance/quote?symbols=AI.PA,LVMH.PA&fields=...
```

**To:**
```
https://query1.finance.yahoo.com/v8/finance/chart/AI.PA?interval=1d&range=1d
```

### 2. Request Strategy

```typescript
// Sequential requests with delay
const symbols = ['AI.PA', 'MC.PA', 'SAF.PA', 'BNP.PA'];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const symbol of symbols) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  );
  
  // Process response
  await delay(1500); // 1.5 second delay between requests
}
```

### 3. Data Extraction

```typescript
interface YahooV8Response {
  chart: {
    result: [{
      meta: {
        symbol: string;
        shortName: string;
        longName: string;
        currency: string;
        regularMarketPrice: number;
        previousClose: number;
        regularMarketVolume: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
      };
      timestamp: number[];
      indicators: {
        quote: [{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }];
      };
    }];
  };
}

function extractStockData(response: YahooV8Response): StockData {
  const result = response.chart.result[0];
  const meta = result.meta;
  
  return {
    symbol: meta.symbol,
    name: meta.shortName || meta.longName,
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose,
    volume: meta.regularMarketVolume,
    marketCap: null, // Not available in v8, but can be calculated
    // Additional data available:
    currency: meta.currency,
    dayHigh: meta.regularMarketDayHigh,
    dayLow: meta.regularMarketDayLow,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow
  };
}
```

### 4. Error Handling

```typescript
async function fetchStockData(symbol: string): Promise<StockData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }
    );

    if (response.status === 429) {
      // Rate limited - wait and retry
      await delay(5000);
      return fetchStockData(symbol);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: YahooV8Response = await response.json();
    
    if (!data.chart?.result?.[0]?.meta) {
      throw new Error('Invalid response format');
    }

    return extractStockData(data);
  } catch (error) {
    console.error(`Failed to fetch data for ${symbol}:`, error);
    return null;
  }
}
```

## Conclusion

The v8/finance/chart endpoint is a superior replacement for the failing v7/finance/quote endpoint:

### ✅ Advantages:
- **Reliable**: No 401 authentication errors
- **More Data**: Additional fields like 52-week range, daily range, currency
- **Flexible**: Support for different time intervals and ranges
- **Real-time**: Intraday data when needed

### ⚠️ Considerations:
- **Rate Limiting**: Must implement sequential requests with delays
- **Single Symbol**: One request per symbol (vs batch requests in v7)
- **User-Agent**: Must include browser User-Agent header

### 🚀 Migration Benefits:
- **Fixes 401 errors**: Immediate resolution of current API issues
- **Enhanced data**: More comprehensive stock information
- **Future-proof**: Active Yahoo Finance endpoint
- **Better reliability**: Consistent data availability

The migration to v8/finance/chart will resolve the current 401 errors and provide enhanced data for the CAC40 monitoring application.
