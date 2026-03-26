import axios, { AxiosResponse } from 'axios';
import { SearchResult } from '../domain/SearchResult.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/market-cli-debug.log', `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    typeshortname?: string;
  }>;
}

export class SymbolSearchClient {
  private readonly baseUrl = 'https://query2.finance.yahoo.com';
  private readonly timeout = 10000;

  async searchSymbols(query: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 1) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/v1/finance/search`;
      debugLog(`SymbolSearchClient: GET ${url}?q=${query}`);
      
      const response: AxiosResponse<YahooSearchResponse> = await axios.get(
        url,
        {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          params: {
            q: query.trim(),
            quotes_count: 3,
            news_count: 0,
            enableFuzzyQuery: false,
            quotesQueryId: 'tss_match_phrase_query'
          }
        }
      );

      debugLog(`SymbolSearchClient: response status = ${response.status}`);
      const quotes = response.data?.quotes || [];
      debugLog(`SymbolSearchClient: ${quotes.length} quotes received`);
      
      return quotes.map(quote => ({
        symbol: quote.symbol || '',
        name: quote.longname || quote.shortname || quote.symbol || '',
        exchange: quote.exchange || '',
        type: quote.typeshortname || ''
      })).filter(result => result.symbol);

    } catch (error) {
      debugLog(`SymbolSearchClient: error - ${error}`);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment.');
        } else if (error.response?.status === 401) {
          throw new Error('Unauthorized access to search API');
        }
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }
}
