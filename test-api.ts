#!/usr/bin/env bun

import { YahooFinanceClient } from './src/infrastructure/YahooFinanceClient.js';
import { progressTracker } from './src/shared/ProgressTracker.js';

/**
 * Simple test script to debug API calls
 */
async function testApiDirectly(): Promise<void> {
  console.log('🧪 Testing Yahoo Finance API directly...\n');
  
  const client = new YahooFinanceClient();
  
  try {
    console.log('1️⃣ Testing connection...');
    const isConnected = await client.testConnection();
    console.log(`   Connection test result: ${isConnected ? '✅ Success' : '❌ Failed'}\n`);
    
    if (isConnected) {
      console.log('2️⃣ Testing limited stock fetch (3 stocks)...');
      const response = await client.fetchLimitedStocks();
      
      if (response.success && response.data) {
        console.log(`   ✅ Successfully fetched ${response.data.length} stocks:`);
        response.data.forEach(stock => {
          console.log(`   📊 ${stock.symbol}: €${stock.price} (${stock.name})`);
        });
      } else {
        console.log(`   ❌ Failed: ${response.error}`);
      }
    } else {
      console.log('   ⚠️ Skipping full test due to connection failure');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
  
  console.log('\n🏁 Test completed.');
}

// Run the test
if (import.meta.main) {
  testApiDirectly().catch(console.error);
}