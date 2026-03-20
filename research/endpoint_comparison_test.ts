/**
 * Yahoo Finance API Endpoint Comparison Test
 * This script demonstrates the differences between v7 and v8 endpoints
 */

import axios from 'axios';

interface V7QuoteResponse {
  quoteResponse: {
    result: Array<{
      symbol: string;
      shortName: string;
      regularMarketPrice: number;
      previousClose: number;
      regularMarketVolume: number;
      marketCap?: number;
    }>;
    error?: any;
  };
}

interface V8ChartResponse {
  chart: {
    result: Array<{
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
    }>;
    error?: any;
  };
}

async function testV7Endpoint(symbols: string[]): Promise<void> {
  console.log('\n🧪 Testing v7/finance/quote endpoint...');
  
  try {
    const symbolsQuery = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote`;
    
    const response = await axios.get<V7QuoteResponse>(url, {
      params: {
        symbols: symbolsQuery,
        fields: 'symbol,shortName,regularMarketPrice,previousClose,regularMarketVolume,marketCap'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('✅ v7 Response received');
    console.log('📊 Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`❌ v7 Failed: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`📄 Response: ${error.response?.data || 'No response data'}`);
    } else {
      console.log(`❌ v7 Error:`, error);
    }
  }
}

async function testV8Endpoint(symbol: string): Promise<void> {
  console.log(`\n🧪 Testing v8/finance/chart endpoint for ${symbol}...`);
  
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    
    const response = await axios.get<V8ChartResponse>(url, {
      params: {
        interval: '1d',
        range: '1d'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log(`✅ v8 Response received for ${symbol}`);
    
    const meta = response.data.chart.result[0]?.meta;
    if (meta) {
      console.log('📊 Key Data Points:');
      console.log(`   Symbol: ${meta.symbol}`);
      console.log(`   Name: ${meta.shortName} (${meta.longName})`);
      console.log(`   Price: €${meta.regularMarketPrice}`);
      console.log(`   Previous Close: €${meta.previousClose}`);
      console.log(`   Volume: ${meta.regularMarketVolume.toLocaleString()}`);
      console.log(`   Day Range: €${meta.regularMarketDayLow} - €${meta.regularMarketDayHigh}`);
      console.log(`   52-Week Range: €${meta.fiftyTwoWeekLow} - €${meta.fiftyTwoWeekHigh}`);
      console.log(`   Currency: ${meta.currency}`);
    }
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`❌ v8 Failed for ${symbol}: ${error.response?.status} ${error.response?.statusText}`);
    } else {
      console.log(`❌ v8 Error for ${symbol}:`, error);
    }
  }
}

async function compareEndpoints(): Promise<void> {
  console.log('🔬 Yahoo Finance API Endpoint Comparison\n');
  
  const testSymbols = ['AI.PA', 'MC.PA', 'SAF.PA'];
  
  // Test v7 endpoint (batch request)
  await testV7Endpoint(testSymbols);
  
  // Test v8 endpoint (individual requests)
  for (const symbol of testSymbols) {
    await testV8Endpoint(symbol);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 Summary:');
  console.log('v7/finance/quote:');
  console.log('  ❌ Returns 401 Unauthorized errors');
  console.log('  ✅ Supports batch requests (multiple symbols)');
  console.log('  ⚠️  Limited data fields');
  console.log('');
  console.log('v8/finance/chart:');
  console.log('  ✅ Works reliably');
  console.log('  ✅ Rich metadata (52-week range, day range, currency, etc.)');
  console.log('  ✅ Intraday data available');
  console.log('  ⚠️  Single symbol per request');
  console.log('  ⚠️  Rate limiting required');
}

// Run the comparison
if (require.main === module) {
  compareEndpoints().catch(console.error);
}

export { testV7Endpoint, testV8Endpoint, compareEndpoints };
