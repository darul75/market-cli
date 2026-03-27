import { Box, Text, ScrollBox } from '@opentui/core';
import type { SearchResult } from '../../domain/SearchResult.js';
import type { SearchTableConfig } from './types.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/market-cli-debug.log', `[${new Date().toISOString()}] SearchResultsTable: ${msg}\n`);
  } catch {}
}

export class SearchResultsTable {
  private results: SearchResult[] = [];
  private selectedIndex: number = -1;
  private onAddStock: (symbol: string, name: string) => void;
  private isSearching: boolean = false;

  private config: SearchTableConfig = {
    maxHeight: 15,
    showHeader: true,
    enableSelection: true,
    enableMouseClicks: true
  };

  constructor(onAddStock: (symbol: string, name: string) => void) {
    this.onAddStock = onAddStock;
  }

  createTable() {
    return Box({
      id: 'search-results-table',
      width: '100%',
      flexDirection: 'column',
      marginTop: 0,
      flexShrink: 0,
      height: 8
    },
      this.createScrollableResults()
    );
  }

  private createScrollableResults() {
    return ScrollBox(
      {
        id: 'search-results-scroll',
        width: '100%',
        height: 8,
        scrollY: true,
        scrollX: false,
        viewportCulling: false,
        flexShrink: 0
      },
      ...this.getContentRows()
    );
  }

  private createDefaultRow() {
    return Box({
      id: 'no-results-row',
      width: '100%',
      height: 8,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 1,
      backgroundColor: '#1a1a1a'
    },
      Text({ 
        content: 'No results yet',
        fg: '#888888' 
      })
    );
  }

  private createSearchingRow() {
    return Box({
      id: 'searching-row',
      width: '100%',
      height: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: '#1a1a1a'
    },
      Text({ 
        content: 'Searching...', 
        fg: '#FFFF00' 
      })
    );
  }

  private createResultRow(result: SearchResult, index: number) {
    
    try {
      const isSelected = index === this.selectedIndex;
      const bgColor = isSelected ? '#0055AA' : (index % 2 === 0 ? '#2a2a2a' : '#1a1a1a');
      const symbolColor = isSelected ? '#00FFFF' : '#00FF00';
      const nameColor = isSelected ? '#FFFFFF' : '#CCCCCC';

      const row = Box({
        id: `search-result-${index}`,
        width: '100%',
        height: 1,
        flexDirection: 'row',
        backgroundColor: bgColor,
        paddingLeft: 1,
        paddingRight: 1,
        onMouseDown: this.config.enableMouseClicks ? 
          () => this.selectAndAddResult(index) : undefined
      },
        Text({ 
          content: result.symbol || '', 
          width: 12, 
          fg: symbolColor 
        }),
        Text({ 
          content: this.truncateName(result.name || ''), 
          width: 30, 
          fg: nameColor 
        }),
        Text({ 
          content: result.exchange || '', 
          width: 12, 
          fg: '#666666' 
        })
      );

      return row;
      
    } catch (error) {
      debugLog(`SearchResultsTable: ERROR creating result row ${index}: ${error}`);
      throw error;
    }
  }

  private truncateName(name: string) {
    if (name.length > 28) {
      return name.substring(0, 25) + '...';
    }
    return name;
  }

  updateRows(results: SearchResult[], isSearching: boolean = false) {
    this.results = results;
    this.isSearching = isSearching;
  }

  private getContentRows() {
    if (this.isSearching && this.results.length === 0) {
      return [this.createSearchingRow()];
    }
    if (this.results.length === 0) {
      return [this.createDefaultRow()];
    }
    return this.results.map((result, index) => this.createResultRow(result, index));
  }

  addStockResult() {
    if (this.selectedIndex > 0) {
      const result = this.results[this.selectedIndex];
      
      this.onAddStock(result.symbol, result.name);
    }
  }

  private selectAndAddResult(index: number) {
    if (index >= 0 && index < this.results.length) {
      this.selectedIndex = index;
      const result = this.results[index];
      
      this.onAddStock(result.symbol, result.name);
      
      this.updateRowSelection();
    }
  }

  private updateRowSelection() {
    this.updateRows(this.results, this.isSearching);
  }

  setSelectedIndex(index: number) {
    if (index >= -1 && index < this.results.length) {
      this.selectedIndex = index;
      this.updateRowSelection();
      debugLog(`Selected index set to ${index}`);
    }
  }

  getSelectedResult(): SearchResult | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      return this.results[this.selectedIndex];
    }
    return null;
  }

  getResultsCount(): number {
    return this.results.length;
  }

  navigateUp(): boolean {
    if (this.selectedIndex > 0) {
      this.setSelectedIndex(this.selectedIndex - 1);
      return true;
    }
    return false;
  }

  navigateDown(): boolean {
    if (this.selectedIndex < this.results.length - 1) {
      this.setSelectedIndex(this.selectedIndex + 1);
      return true;
    }
    return false;
  }

  selectFirst(): boolean {
    if (this.results.length > 0) {
      this.setSelectedIndex(0);
      return true;
    }
    return false;
  }
}