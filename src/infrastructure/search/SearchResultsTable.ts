import { Box, Text, ScrollBox } from '@opentui/core';
import { SearchResult } from '../../domain/SearchResult.js';
import { SearchTableConfig } from './types.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/marker-cli-debug.log', `[${new Date().toISOString()}] SearchResultsTable: ${msg}\n`);
  } catch {}
}

/**
 * SearchResultsTable component - displays search results in table format
 * Responsibilities:
 * - Display search results similar to stock table
 * - Show "No results yet" by default
 * - Handle row selection and mouse clicks
 * - Efficient row updates (no component recreation)
 */
export class SearchResultsTable {
  private results: SearchResult[] = [];
  private selectedIndex: number = -1;
  private onAddStock: (symbol: string, name: string) => void;
  private tableContainer: any = null;
  private isSearching: boolean = false;

  private config: SearchTableConfig = {
    maxHeight: 15,
    showHeader: true,
    enableSelection: true,
    enableMouseClicks: true
  };

  constructor(onAddStock: (symbol: string, name: string) => void) {
    this.onAddStock = onAddStock;
    debugLog('SearchResultsTable initialized');
  }

  /**
   * Create the complete results table structure
   * This is created once and never recreated
   */
  createTable(): any {
    debugLog('Creating search results table structure');

    this.tableContainer = Box({
      id: 'search-results-table',
      width: '100%',
      flexDirection: 'column',
      marginTop: 1,
      flexShrink: 0,
      height: 8
    },
      // Scrollable results container
      this.createScrollableResults()
    );

    return this.tableContainer;
  }

  /**
   * Create scrollable results container
   */
private createScrollableResults(): any {
  return ScrollBox(
    {
      id: 'search-results-scroll',
      width: '100%',
      height: 3,
      scrollY: true,
      scrollX: false,
      viewportCulling: false,
      flexShrink: 0
    },
    ...this.getContentRows()
  );
}

  /**
   * Create the default "No results yet" row
   */
  private createDefaultRow(): any {
    debugLog('Creating default "No results yet" row');

    return Box({
      id: 'no-results-row',
      width: '100%',
      height: 1,
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

  /**
   * Create a "Searching..." row
   */
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

  /**
   * Create a single result row (similar to stock table row)
   */
  private createResultRow(result: SearchResult, index: number): any {
    debugLog(`SearchResultsTable: Creating result row ${index} for ${result.symbol}`);
    
    try {
      const isSelected = index === this.selectedIndex;
      const bgColor = isSelected ? '#0055AA' : (index % 2 === 0 ? '#2a2a2a' : '#1a1a1a');
      const symbolColor = isSelected ? '#00FFFF' : '#00FF00';
      const nameColor = isSelected ? '#FFFFFF' : '#CCCCCC';

      debugLog(`SearchResultsTable: Creating Box for result ${index}`);
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

      debugLog(`SearchResultsTable: Successfully created result row ${index}`);
      return row;
      
    } catch (error) {
      debugLog(`SearchResultsTable: ERROR creating result row ${index}: ${error}`);
      throw error;
    }
  }

  /**
   * Truncate name if too long to fit in column
   */
  private truncateName(name: string): string {
    if (name.length > 28) {
      return name.substring(0, 25) + '...';
    }
    return name;
  }

  /**
   * Update stored state only — the next createTable() call will render from this.
   */
  updateRows(results: SearchResult[], isSearching: boolean = false): void {
    this.results = results;
    this.isSearching = isSearching;
    this.selectedIndex = -1;
  }

  private getContentRows(): any[] {
    if (this.isSearching && this.results.length === 0) {
      return [this.createSearchingRow()];
    }
    if (this.results.length === 0) {
      return [this.createDefaultRow()];
    }
    return this.results.map((result, index) => this.createResultRow(result, index));
  }

  /**
   * Handle result selection and addition
   */
  private selectAndAddResult(index: number): void {
    debugLog(`Selecting result at index ${index}`);
    
    if (index >= 0 && index < this.results.length) {
      this.selectedIndex = index;
      const result = this.results[index];
      
      debugLog(`Adding stock: ${result.symbol} - ${result.name}`);
      this.onAddStock(result.symbol, result.name);
      
      // Update row colors to show selection (efficient update)
      this.updateRowSelection();
    }
  }

  /**
   * Update row selection colors without recreating rows
   */
  private updateRowSelection(): void {
    // For now, we'll recreate the rows to show selection
    // In a more advanced implementation, we could update colors directly
    this.updateRows(this.results, this.isSearching);
  }

  /**
   * Set selected index programmatically (for keyboard navigation)
   */
  setSelectedIndex(index: number): void {
    if (index >= -1 && index < this.results.length) {
      this.selectedIndex = index;
      this.updateRowSelection();
      debugLog(`Selected index set to ${index}`);
    }
  }

  /**
   * Get currently selected result
   */
  getSelectedResult(): SearchResult | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      return this.results[this.selectedIndex];
    }
    return null;
  }

  /**
   * Get current results count
   */
  getResultsCount(): number {
    return this.results.length;
  }

  /**
   * Navigate selection up
   */
  navigateUp(): boolean {
    if (this.selectedIndex > 0) {
      this.setSelectedIndex(this.selectedIndex - 1);
      return true;
    }
    return false;
  }

  /**
   * Navigate selection down
   */
  navigateDown(): boolean {
    if (this.selectedIndex < this.results.length - 1) {
      this.setSelectedIndex(this.selectedIndex + 1);
      return true;
    }
    return false;
  }

  /**
   * Select first result
   */
  selectFirst(): boolean {
    if (this.results.length > 0) {
      this.setSelectedIndex(0);
      return true;
    }
    return false;
  }
}