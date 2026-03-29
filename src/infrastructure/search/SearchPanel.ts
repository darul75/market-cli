import { Box, Text } from '@opentui/core';
import { Subscription, combineLatest, debounceTime } from 'rxjs';
import { SearchInput } from './SearchInput.js';
import { SearchResultsTable } from './SearchResultsTable.js';
import type { SearchResult } from '../../domain/SearchResult.js';
import type { SearchService } from '../../application/SearchService.js';

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
    private onRequestRerender: () => void,
    private onMouseOver: () => void,
  ) {
    this.searchService = searchService;

    this.searchInput = new SearchInput(searchService, (value) => {
      this.state.query = value;
    });

    this.resultsTable = new SearchResultsTable(onAddStock);

    this.setupSubscriptions();
  }

  show() {
    if (this.state.visible) return;
  
    this.state.visible = true;
        
    this.setupSubscriptions();
    
    this.searchService.clearResults();
    this.state.query = '';
    this.state.selectedIndex = -1;
    this.state.isSearching = false;
  }

  hide() {
    if (!this.state.visible) return;
    
    this.cleanupSubscriptions();
    
    this.searchInput.clear();
    this.state.query = '';
    this.state.selectedIndex = -1;
    this.state.isSearching = false;
  }

  close() {
    this.hide();
    this.onClose();
  }

  addStock() {
    this.resultsTable.addStockResult();
  }

  moveSelectionUp() {
    this.resultsTable.navigateUp();
    this.onRequestRerender();
  }

  moveSelectionDown() {
    this.resultsTable.navigateDown();
    this.onRequestRerender();
  }

  private setupSubscriptions() {
    if (this.subscription) {
      this.cleanupSubscriptions();
    }

    this.subscription = combineLatest([
      this.searchService.searchResults$,
      this.searchService.isSearching$
    ]).pipe(
      debounceTime(1000)
    ).subscribe(([results, isSearching]) => {
      this.handleSearchUpdate(results, isSearching);
    });
  }

  private handleSearchUpdate(results: SearchResult[], isSearching: boolean) {
    try {
      this.state.isSearching = isSearching;
      this.state.selectedIndex = -1;
      
      this.resultsTable.updateRows(results, isSearching);

      this.onRequestRerender();

    } catch (error) {
    }
  }

  private cleanupSubscriptions() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  render(shouldFocus: boolean = true) {
    if (!this.state.visible) return null;

    const inputComponent = this.searchInput.render(this.state.query, shouldFocus);

    const tableComponent = this.resultsTable.createTable();

    this.panelContainer = Box({
      id: 'search-panel',
      width: 76,
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: '#666666',
      backgroundColor: '#000000',
      paddingLeft: 1,
      paddingRight: 1,
      onMouseOver: this.onMouseOver
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
      Box({        
        width: '100%',
        height: 3,
        borderStyle: 'single',
        borderColor: '#666666',
        backgroundColor: '#000000',
        paddingLeft: 1,
      }, 
      // Search input
      inputComponent,
      ),
      // Results table
      tableComponent
    );

    return this.panelContainer;
  }

  destroy(): void {
    this.cleanupSubscriptions();
    this.state.visible = false;
  }
}