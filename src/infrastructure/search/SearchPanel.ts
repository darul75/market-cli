import { Box, Text } from '@opentui/core';
import { Subscription, combineLatest, debounceTime } from 'rxjs';
import { SearchInput } from './SearchInput.js';
import { SearchResultsTable } from './SearchResultsTable.js';
import { SearchResult } from '../../domain/SearchResult.js';
import { SearchService } from '../../application/SearchService.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/marker-cli-debug.log', `[${new Date().toISOString()}] SearchPanel: ${msg}\n`);
  } catch {}
}

interface SearchPanelState {
  visible: boolean;
  query: string;
  selectedIndex: number;
  isSearching: boolean;
}

export class SearchPanel {
  private searchInput: SearchInput;
  private resultsTable: SearchResultsTable;
  private searchService: SearchService;
  private subscription: Subscription | null = null;
  private panelContainer: any = null;

  private state: SearchPanelState = {
    visible: true,
    query: '',
    selectedIndex: -1,
    isSearching: false
  };

  constructor(
    searchService: SearchService,
    onAddStock: (symbol: string, name: string) => void,
    private onClose: () => void,
    private onRequestRerender: () => void
  ) {
    debugLog('SearchPanel initialized');
    this.searchService = searchService;

    // Create search input component — callback keeps state.query in sync
    this.searchInput = new SearchInput(searchService, (value) => {
      this.state.query = value;
    });

    // Create results table component (pass onAddStock callback)
    this.resultsTable = new SearchResultsTable(onAddStock);

    this.setupSubscriptions();
  }

  /**
   * Show the search panel and setup subscriptions
   */
  show(): void {
    if (this.state.visible) return;
    
    debugLog('Showing search panel');
    this.state.visible = true;
    
    // Setup RxJS subscriptions for reactive search
    this.setupSubscriptions();
    
    // Clear previous search state
    this.searchService.clearResults();
    this.state.query = '';
    this.state.selectedIndex = -1;
    this.state.isSearching = false;
  }

  /**
   * Hide the search panel and cleanup
   */
  hide(): void {
    if (!this.state.visible) return;
    
    debugLog('Hiding search panel');
    // this.state.visible = false;
    
    // Cleanup subscriptions
    this.cleanupSubscriptions();
    
    // Clear search state
    this.searchInput.clear();
    this.state.query = '';
    this.state.selectedIndex = -1;
    this.state.isSearching = false;
  }

  /**
   * Close search panel (called from close button or escape key)
   */
  close(): void {
    debugLog('Closing search panel');
    this.hide();
    this.onClose();
  }

  /**
   * Setup RxJS subscriptions - optimized to prevent UI freezing
   */
  private setupSubscriptions(): void {
    if (this.subscription) {
      this.cleanupSubscriptions();
    }

    debugLog('Setting up search subscriptions');

    // Single combined subscription to prevent double UI updates
    this.subscription = combineLatest([
      this.searchService.searchResults$,
      this.searchService.isSearching$
    ]).pipe(
      // Debounce UI updates to prevent excessive re-rendering during typing
      debounceTime(1000)
    ).subscribe(([results, isSearching]) => {
      this.handleSearchUpdate(results, isSearching);
    });

    debugLog('Search subscriptions established');
  }

  /**
   * Handle search updates - ONLY updates the results table, never rebuilds UI
   */
  private handleSearchUpdate(results: SearchResult[], isSearching: boolean): void {
    debugLog(`=== SEARCH UPDATE START ===`);
    debugLog(`Search update: ${results.length} results, isSearching: ${isSearching}`);
    
    try {
      // Log result details for debugging
      if (results.length > 0) {
        results.forEach((result, index) => {
          debugLog(`Result ${index}: ${result.symbol} - ${result.name} (${result.exchange})`);
        });
      }

      // Update internal state
      this.state.isSearching = isSearching;
      this.state.selectedIndex = -1; // Reset selection
      
      // Update ONLY the results table - no full UI rebuild
      debugLog('Calling resultsTable.updateRows...');
      this.resultsTable.updateRows(results, isSearching);
      debugLog('resultsTable.updateRows completed successfully');
      
      debugLog('Search update completed - no UI rebuild triggered');

      this.onRequestRerender();

    } catch (error) {
      debugLog(`CRITICAL ERROR in handleSearchUpdate: ${error}`);
      debugLog(`Stack trace: ${(error as Error)?.stack || 'No stack'}`);
      throw error; // Re-throw to see where it gets caught
    }
  }

  /**
   * Cleanup subscriptions
   */
  private cleanupSubscriptions(): void {
    if (this.subscription) {
      debugLog('Cleaning up search subscriptions');
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Render the complete search panel UI
   */
  render(): any {
    if (!this.state.visible) return null;

    debugLog('Rendering search panel');

    // Create input component, passing current query so it survives rerenders
    const inputComponent = this.searchInput.render(this.state.query);
     
    // Focus the input when rendering
    // this.searchInput.focus();
    // debugLog('Search input focused');

    // Create results table
    const tableComponent = this.resultsTable.createTable();

    this.panelContainer = Box({
      id: 'search-panel',
      width: 76,
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: '#666666',
      backgroundColor: '#000000',
      paddingLeft: 1,
      paddingRight: 1

    },
      // Title bar
      Box({
        id: 'search-title',
        width: '100%',
        height: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
        Text({
          content: '🔍 Search Stocks',
          fg: '#00FF00'
        })
      ),
      
      // Search input
      inputComponent,
      
      // Results table  
      tableComponent
    );

    return this.panelContainer;
  }

  /**
   * Destroy the search panel and cleanup resources
   */
  destroy(): void {
    debugLog('Destroying search panel');
    this.cleanupSubscriptions();
    this.state.visible = false;
  }
}