import { createCliRenderer, Box, Text, CliRenderer, ScrollBox, Input, InputRenderableEvents } from '@opentui/core';
import { Stock, MarketData, Position, Transaction } from '../domain/index.js';
import { calculatePositionSummary, calculateTransactionsWithPL } from '../domain/PositionCalculator.js';
import { AppStatus, SearchService } from '../application/index.js';
import { SearchPanel } from './search/index.js';
import { PortfolioStore } from './PortfolioStore.js';
import { HistoricalPriceService } from './HistoricalPriceService.js';

function debugLog(msg: string): void {
  try {
    const fs2 = require('fs');
    fs2.appendFileSync('/tmp/market-cli-debug.log', `[${new Date().toISOString()}] TerminalRenderer: ${msg}\n`);
  } catch {}
}

const HEADER_WIDTH_QUANTITY = 9;
const HEADER_WIDTH_INVESTED = 11;
const HEADER_WIDTH_VALUE = 11;

/**
 * Interface for loading progress information
 */
export interface LoadingProgress {
  currentBatch: number;
  totalBatches: number;
  completedStocks: number;
  totalStocks: number;
  currentBatchStocks: string[];
  successCount: number;
  errorCount: number;
  recentErrors: string[];
  elapsedTime: number;
}

/**
 * OpenTUI terminal renderer for the stock monitoring interface
 */
export class TerminalRenderer {
  private renderer!: CliRenderer;
  private isInitialized = false;
  private resizeTimeout?: NodeJS.Timeout; // For debounced resize handling
  private selectedIndex: number = -1; // Currently selected row (-1 = none)
  private selectedSymbol: string | null = null; // Currently selected stock symbol
  private marketData: MarketData | null = null; // Cache for re-rendering
  private currentStatus: AppStatus | null = null; // Cache current status for re-rendering
  
  // Search panel (new architecture)
  private searchPanel: SearchPanel | null = null;

  // Portfolio tracking
  private positions: Position[] = [];
  private portfolioStore: PortfolioStore = new PortfolioStore();
  private historicalPriceService: HistoricalPriceService = new HistoricalPriceService();

  // Dialog state
  private dialogMode: 'none' | 'buy' | 'sell' = 'none';
  private dialogSymbol: string = '';
  private dialogYear: number = new Date().getFullYear();
  private dialogMonth: number = new Date().getMonth();
  private dialogDay: number = new Date().getDate();
  private dialogQty: string = '';
  private dialogPrice: string = '';
  private dialogUseDayPrice: boolean = true;
  private dialogFetchingPrice: boolean = false;
  private dialogFetchTimer?: NodeJS.Timeout;

  // Expanded purchase history panels
  private expandedSymbols: Set<string> = new Set();


  /**
   * Initialize the renderer
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎨 Initializing OpenTUI renderer...');
      this.renderer = await createCliRenderer({
        exitOnCtrlC: true,
        useMouse: true, // Enable mouse events
        autoFocus: true, // Focus nearest focusable on left click
        enableMouseMovement: true // Enable hover tracking
      });
      this.isInitialized = true;
      
      // Set up resize event handling
      this.setupResizeHandling();
      
      console.log('✅ OpenTUI renderer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OpenTUI renderer:', error);
      throw error;
    }
  }

  /**
   * Set up terminal resize event handling
   */
  private setupResizeHandling(): void {
    // Listen for terminal resize events if available
    if (process.stdout && process.stdout.on) {
      process.stdout.on('resize', this.handleResize);
    }
    
    // Also listen for SIGWINCH (window change) signals
    if (process.on) {
      process.on('SIGWINCH', this.handleResize);
    }
  }

  /**
  /**
   * Handle debounced terminal resize events
   */
  private handleResize = () => {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
      // Preserve relative scroll position during resize
      this.preserveRelativeScrollPosition();
      
      // The flex layout will automatically handle the resize
      // OpenTUI's flex system should adapt ScrollBox height automatically
      
      // Restore relative scroll position after resize
      this.restoreRelativeScrollPosition();
    }, 300); // 300ms debounce
  };

  /**
   * Preserve relative scroll position before resize
   */
  preserveRelativeScrollPosition(): void {
    // This will be enhanced when we have access to actual ScrollBox state
    // For now, it's a placeholder for relative position calculation
  }

  /**
   * Restore relative scroll position after resize  
   */
  restoreRelativeScrollPosition(): void {
    // This will be enhanced when we have access to actual ScrollBox state
    // For now, it's a placeholder for relative position restoration
  }

  /**
   * Clear the screen by removing all children from the root
   */
  private clearScreen(): void {
    if (!this.isInitialized) return;
    
    try {
      // Remove all existing children from the root
      const children = this.renderer.root.getChildren();
      for (const child of children) {
        if (child && child.id) {
          try {
            this.renderer.root.remove(child.id);
          } catch (e) {
            // Ignore errors removing individual children
          }
        }
      }
    } catch (e) {
      // Ignore errors during clear
    }
  }

  /**
   * Handle row click to toggle selection
   */
  private handleRowClick(stock: Stock, index: number): void {
    // Toggle selection: if already selected, deselect
    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.selectedSymbol = null;
    } else {
      this.selectedIndex = index;
      this.selectedSymbol = stock.symbol;
    }
    
    // Re-render with cached status (preserves timestamp)
    this.renderWithCurrentStatus();
  }

  /**
   * Re-render with cached data and status (preserves timestamp)
   */
  private renderWithCurrentStatus(): void {
    if (this.marketData && this.currentStatus) {
      this.renderStockTable(this.marketData, this.currentStatus);
    }
  }

  /**
   * Truncate a name string to fit in the column width
   */
  private truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 3) + '...';
  }

  /**
   * Create an action button (move up, move down, delete)
   */
  private createActionButton(
    symbol: string,
    color: string,
    handler: () => void,
    isVisible: boolean = true,
    marginLeft: number = 0,
  ) {
    if (!isVisible) {
      // Invisible button (transparent, preserves layout)
      return Box(
        {
          width: 2,
          height: 1,
          backgroundColor: 'transparent',
          marginLeft
        },
        Text({ content: ' ', width: 1 })
      );
    }
    
    // Visible button: colored symbol with click handler
    return Box(
      {
        width: 2,
        height: 1,
        marginLeft,
        onMouseDown: (event) => {
          event.stopPropagation(); // Prevent row selection handler
          handler();
        }
      },
      Text({ content: symbol, width: 2, fg: color })
    );
  }

  /**
   * Handle move up action
   */
  private handleMoveUp(index: number): void {
    if (index <= 0) return;
    
    const stock = this.marketData!.stocks[index];
    const prevStock = this.marketData!.stocks[index - 1];
    
    // Swap in marketData
    this.marketData!.stocks[index] = prevStock;
    this.marketData!.stocks[index - 1] = stock;
    
    // Sync positions order
    const stockIdx = this.positions.findIndex(p => p.symbol === stock.symbol);
    const prevIdx = this.positions.findIndex(p => p.symbol === prevStock.symbol);
    if (stockIdx > -1 && prevIdx > -1) {
      [this.positions[stockIdx], this.positions[prevIdx]] = 
      [this.positions[prevIdx], this.positions[stockIdx]];
    }
    
    this.selectedIndex = index - 1;
    this.savePortfolio();
    this.renderWithCurrentStatus();
  }

  /**
   * Handle move down action
   */
  private handleMoveDown(index: number): void {
    if (index >= this.marketData!.stocks.length - 1) return;
    
    const stock = this.marketData!.stocks[index];
    const nextStock = this.marketData!.stocks[index + 1];
    
    // Swap in marketData
    this.marketData!.stocks[index] = nextStock;
    this.marketData!.stocks[index + 1] = stock;
    
    // Sync positions order
    const stockIdx = this.positions.findIndex(p => p.symbol === stock.symbol);
    const nextIdx = this.positions.findIndex(p => p.symbol === nextStock.symbol);
    if (stockIdx > -1 && nextIdx > -1) {
      [this.positions[stockIdx], this.positions[nextIdx]] = 
      [this.positions[nextIdx], this.positions[stockIdx]];
    }
    
    this.selectedIndex = index + 1;
    this.savePortfolio();
    this.renderWithCurrentStatus();
  }

  /**
   * Handle delete action
   */
  private handleDelete(index: number): void {
    const stock = this.marketData!.stocks[index];

    // Remove stock from array
    this.marketData!.stocks.splice(index, 1);

    this.positions = this.positions.filter(p => p.symbol !== stock.symbol);
    
    // Adjust selection if needed
    if (this.selectedIndex >= this.marketData!.stocks.length) {
      this.selectedIndex = Math.max(0, this.marketData!.stocks.length - 1);
    }
    
    this.savePortfolio();
    
    // Re-render
    this.renderWithCurrentStatus();
  }

  /**
   * Get currently selected row index
   */
  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Get currently selected stock symbol
   */
  public getSelectedSymbol(): string | null {
    return this.selectedSymbol;
  }

  /**
   * Clear current selection
   */
  public clearSelection(): void {
    this.selectedIndex = -1;
    this.selectedSymbol = null;
  }

  /**
   * Set up the search service with new architecture
   */
  public setupSearchService(searchService: SearchService, onAddStock: (symbol: string, name: string) => void): void {
    debugLog('Setting up search service with new architecture');
    
    // Create the search panel with proper callbacks
    this.searchPanel = new SearchPanel(
      searchService,
      onAddStock,
      () => {}, // Close callback
      () => this.renderWithCurrentStatus()
    );
    
    debugLog('Search panel created successfully');
  }

  /**
   * Create search panel using new architecture
   */
  private createSearchPanel(): any {
    if (!this.searchPanel) {
      debugLog('ERROR: searchPanel is null when trying to render');
      return null;
    }
    
    return this.searchPanel.render();
  }

  /**
   * Create search panel and portfolio total side by side
   */
  private createSearchWithTotal(): any {
    const searchPanel = this.createSearchPanel();
    const portfolioTotal = this.createPortfolioTotalBox();

    return Box(
      {
        width: '100%',
        flexDirection: 'row',
        gap: 1
      },
      searchPanel || Box({}),
      portfolioTotal
    );
  }

  /**
   * Create portfolio total display box
   */
  private createPortfolioTotalBox(): any {
    const total = this.getPortfolioTotal();
    const currencySymbol = '€';
    const valueStr = `${currencySymbol}${total.value.toFixed(0)}`;
    const plSign = total.pl >= 0 ? '+' : '';
    const plColor = total.pl >= 0 ? '#00FF00' : '#FF0000';
    const plStr = `${plSign}${currencySymbol}${total.pl.toFixed(0)} (${plSign}${total.plPercent.toFixed(1)}%)`;

    return Box(
      {
        id: 'portfolio-total',
        width: 46,
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#666666',
        backgroundColor: '#000000',
        paddingLeft: 1,
        paddingRight: 1
      },
      Box(
        {
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          height: 1
        },
        Text({
          content: '💼 Portfolio',
          fg: '#00FF00'
        })
      ),
      Box(
        {
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 2,
          marginTop: 1
        },
        Text({
          content: valueStr,
          fg: '#FFFFFF'
        })
      ),
      Box(
        {
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 2
        },
        Text({
          content: plStr,
          fg: plColor
        })
      )
    );
  }

  /**
   * Render the main stock monitoring interface
   */
  renderStockTable(marketData: MarketData, status: AppStatus): void {
    if (!this.isInitialized) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    // Cache data for re-rendering when selection changes
    this.marketData = marketData;
    this.currentStatus = status; // Cache status to prevent timestamp updates on selection

    // Clear previous content first
    this.clearScreen();

    // Create search panel and portfolio total side by side
    const searchAndTotal = this.createSearchWithTotal();

    // Normal content column
    const content = Box(
      {
        width: '100%',
        flexDirection: 'column',
        flexGrow: 1
      },
      this.createHeader(status),
      this.createMarketSummary(marketData),
      this.createStockTable(marketData.stocks),
      searchAndTotal,
      this.createFooter(status)
    );

    this.renderer.root.add(
      Box(
        { width: '100%', height: '100%', flexDirection: 'column', padding: 1 },
        content
      )
    );

    if (this.dialogMode !== 'none') {
      this.renderer.root.add(
        Box(
          {
            id: 'dialog-overlay',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100
          },
          this.createTransactionDialog()
        )
      );
    }
  }

  /**
   * Render loading state with detailed progress information
   */
  renderLoading(progress?: LoadingProgress): void {
    if (!this.isInitialized) return;
    
    // Clear previous content first
    this.clearScreen();
    
    const elements = [];
    
    // Main loading message
    elements.push(
      Text({
        content: '🔄 Loading data...',
        fg: '#00FF00'
      })
    );
    
    // Add progress details if available
    if (progress) {
      elements.push(
        Box(
          {
            width: '80%',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 2,
            borderStyle: 'single',
            borderColor: '#333333',
            padding: 1
          },
          Text({
            content: `Batch ${progress.currentBatch}/${progress.totalBatches}`,
            fg: '#FFFFFF'
          }),
          Text({
            content: `Stocks: ${progress.completedStocks}/${progress.totalStocks}`,
            fg: '#00BFFF'
          }),
          Text({
            content: progress.currentBatchStocks.length > 0 ? 
              `Processing: ${progress.currentBatchStocks.join(', ')}` : 
              'Waiting for next batch...',
            fg: '#CCCCCC'
          }),
          Box(
            {
              flexDirection: 'row',
              gap: 3,
              marginTop: 1
            },
            Text({
              content: `✅ Success: ${progress.successCount}`,
              fg: '#00FF00'
            }),
            Text({
              content: `❌ Errors: ${progress.errorCount}`,
              fg: '#FF0000'
            })
          ),
          Text({
            content: `Elapsed: ${progress.elapsedTime}s`,
            fg: '#AAAAAA'
          })
        )
      );
      
      // Show recent errors if any
      if (progress.recentErrors.length > 0) {
        elements.push(
          Box(
            {
              width: '80%',
              flexDirection: 'column',
              marginTop: 1,
              borderStyle: 'single',
              borderColor: '#FF0000',
              padding: 1
            },
            Text({
              content: 'Recent Errors:',
              fg: '#FF0000'
            }),
            ...progress.recentErrors.slice(0, 3).map((error: string) => 
              Text({
                content: error.length > 60 ? error.substring(0, 57) + '...' : error,
                fg: '#FF6B6B'
              })
            )
          )
        );
      }
    }
    
    // Instructions
    elements.push(
      Box(
        {
          marginTop: 2,
          flexDirection: 'column',
          alignItems: 'center'
        },
        Text({
          content: 'Please wait while we fetch live market data...',
          fg: '#CCCCCC'
        }),
        Text({
          content: 'Press Ctrl+C to cancel',
          fg: '#AAAAAA'
        })
      )
    );
    
    this.renderer.root.add(
      Box(
        {
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2
        },
        ...elements
      )
    );
  }

  /**
   * Render error state
   */
  renderError(error: string): void {
    if (!this.isInitialized) return;
    
    // Clear previous content first
    this.clearScreen();
    
    this.renderer.root.add(
      Box(
        {
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2
        },
        Text({
          content: '❌ API Connection Failed',
          fg: '#FF0000'
        }),
        Text({
          content: error,
          fg: '#FF6B6B'
        }),
        Text({
          content: 'Press Ctrl+C to exit',
          fg: '#CCCCCC'
        })
      )
    );
  }

  /**
   * Render empty state when no stocks in portfolio
   */
  renderEmptyState(message: string = 'Press Ctrl+F to search and add stocks'): void {
    if (!this.isInitialized) return;
    
    this.clearScreen();
    
    this.renderer.root.add(
      Box(
        {
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2
        },
        Text({
          content: '📊 No stocks in portfolio',
          fg: '#00FFFF',
          width: 30
        }),
        Box({ width: '100%', height: 1 }),
        Text({
          content: message,
          fg: '#888888'
        })
      )
    );
  }

  /**
   * Create header component
   */
  private createHeader(status: AppStatus) {
    return Box(
      {
        width: '100%',
        height: 3,
        borderStyle: 'single',
        borderColor: '#00FF00',
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column'
      },
        Box(
          {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          },
          // Left side: Title + Search button (small gap)
          Box(
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              height:1
            },
            Text({
              content: '📈 Stock Live Monitor',
              fg: '#00FF00'
            }),
          ),
          // Right side: Status indicator (far right)
          Text({
            content: this.getStatusIndicator(status),
            fg: status.isConnected ? '#00FF00' : '#FF0000'
          })
        )
    );
  }

  /**
   * Create market summary component
   */
  private createMarketSummary(marketData: MarketData) {
    const summary = marketData.getSummary();
    
    return Box(
      {
        width: '100%',
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      },
      Box(
        {
          flexDirection: 'row',
          gap: 4
        },
        Text({
          content: `Stocks: ${summary.totalStocks}`,
          fg: '#FFFFFF'
        }),
        Text({
          content: `↑ ${summary.gainers}`,
          fg: '#00FF00'
        }),
        Text({
          content: `↓ ${summary.losers}`,
          fg: '#FF0000'
        })
      ),
      Text({
        content: `Sentiment: ${summary.sentiment}`,
        fg: this.getSentimentColor(summary.sentiment)
      })
    );
  }

  /**
   * Create stock table component with scrollable container
   */
  private createStockTable(stocks: Stock[]) {
    // Table header (fixed, outside scroll area)
    const headerRow = this.createTableHeader();
    
    // Create scrollable stock rows with zebra striping and purchase panels
    const rows: any[] = [];
    
    // Show empty state message inside the table
    if (stocks.length === 0) {
      rows.push(
        Box(
          {
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 2,
            paddingBottom: 2
          },
          Text({
            content: '📊 No stocks in portfolio',
            fg: '#00FFFF',
            width: 30
          })
        )
      );
    } else {
      stocks.forEach((stock, index) => {
        rows.push(this.createStockRow(stock, index + 1, index % 2 === 0, index === this.selectedIndex));
        if (this.expandedSymbols.has(stock.symbol)) {
          rows.push(this.createPurchaseHistoryPanel(stock.symbol));
        }
      });
    }

    // Create scrollable container for stock rows
    const scrollableContent = ScrollBox(
      {
        width: '100%',
        flexGrow: 1, // Take all available vertical space
        minHeight: 3, // Minimum 3 rows for small terminals
        scrollY: true,
        scrollX: false,
        viewportCulling: true // Performance optimization for large lists
      },
      ...rows
    );

    return Box(
      {
        width: '100%',
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#666666',
        flexGrow: 1
      },
      headerRow,
      scrollableContent
    );
  }

  /**
   * Create table header
   */
  private createTableHeader() {
    return Box(
      {
        width: '100%',
        height: 1,
        backgroundColor: '#333333',
        flexDirection: 'row',
        padding: 1
      },
      Text({ content: '#', width: 5, fg: '#FFFFFF' }),
      Text({ content: 'Symbol', width: 10, fg: '#FFFFFF' }),
      Text({ content: 'Name', width: 20, fg: '#FFFFFF' }),
      Text({ content: 'Price', width: 10, fg: '#FFFFFF' }),
      Text({ content: 'Change', width: 8, fg: '#FFFFFF' }),
      Text({ content: 'Qty', width: HEADER_WIDTH_QUANTITY, fg: '#FFFFFF' }),
      Text({ content: 'Invested', width: HEADER_WIDTH_INVESTED, fg: '#FFFFFF' }),
      Text({ content: 'Value', width: HEADER_WIDTH_VALUE, fg: '#FFFFFF' }),
      Text({ content: 'Unreal.', width: HEADER_WIDTH_VALUE, fg: '#FFFFFF' }),
      Text({ content: 'Real.', width: 10, fg: '#FFFFFF' }),
      Text({ content: 'Actions', width: 15, fg: '#FFFFFF' })
    );
  }

  /**
   * Create individual stock row with zebra striping and selection support
   */
  private createStockRow(stock: Stock, index: number, isEvenRow: boolean = false, isSelected: boolean = false) {
    const changeColor = stock.isPositive ? '#00FF00' : '#FF0000';
    
    let backgroundColor: string;
    if (isSelected) {
      backgroundColor = '#0055AA';
    } else {
      backgroundColor = isEvenRow ? '#2a2a2a' : '#1a1a1a';
    }
    
    const symbolColor = isSelected ? '#00FFFF' : '#00BFFF';
    const position = this.getPosition(stock.symbol);
    const pos = this.calculatePositionSummary(stock.symbol, stock.price.amount);
    
    const hasPosition = pos.qty > 0;
    const hasTransactions = position && position.transactions.length > 0;
    const currencySymbol = stock.price.currency === 'EUR' ? '€' : stock.price.currency;

    const moveUpButton = this.createActionButton('🔼', '#00FF00', () => this.handleMoveUp(index - 1), isSelected, !pos.qty || pos.qty === 0 ? 4: 2);
    const moveDownButton = this.createActionButton('🔽', '#FFFF00', () => this.handleMoveDown(index - 1), isSelected);    

    const qtyText = hasPosition ? pos.qty.toString() : '-';
    const investedText = hasTransactions ? `${currencySymbol}${pos.totalInvested.toFixed(0)}` : '-';
    const valueText = hasPosition ? `${currencySymbol}${pos.currentValue.toFixed(0)}` : '-';
    
    const unrealColor = pos.unrealizedPL >= 0 ? '#00FF00' : '#FF0000';
    const unrealSign = pos.unrealizedPL >= 0 ? '+' : '';
    const unrealText = hasTransactions ? `${unrealSign}${currencySymbol}${pos.unrealizedPL.toFixed(0)}` : '-';
    
    const realColor = pos.realizedPL >= 0 ? '#00FF00' : '#FF0000';
    const realSign = pos.realizedPL >= 0 ? '+' : '';
    const realText = hasTransactions ? `${realSign}${currencySymbol}${pos.realizedPL.toFixed(0)}` : '-';

    const buyBtn = this.createActionButton('📈', '#00FF88', () => this.openBuyDialog(stock.symbol), isSelected, 0);
    const sellBtn = this.createActionButton('📉', '#FF8888', () => this.openSellDialog(stock.symbol), !hasPosition || !isSelected ? false : true, 1);
    const deleteBtn = this.createActionButton('❌', '#FF0000', () => this.handleDelete(index - 1), isSelected, 1);
    
    const isExpanded = this.expandedSymbols.has(stock.symbol);
    const detailsBtn = this.createActionButton('📋', isExpanded ? '#00FFFF' : '#888888', () => {
      if (isExpanded) {
        this.expandedSymbols.delete(stock.symbol);
      } else {
        this.expandedSymbols.add(stock.symbol);
      }
      this.renderWithCurrentStatus();
    }, isSelected && hasTransactions, 1);
    
    const buttonSpacer = Box({ width: 1, height: 1, backgroundColor: 'transparent' }, Text({ content: ' ', width: 1 }));

    return Box(
      {
        id: `stock-row-${stock.symbol}-${index}`,
        width: '100%',
        paddingLeft: 1,
        paddingRight: 1,
        height: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor,
        focusable: true,
        onMouseDown: (event) => {
          if (this.dialogMode !== 'none') return;
          if (event.button === 0) {
            this.handleRowClick(stock, index - 1);
          }
        }
      },
      Text({ content: index.toString(), width: 5, fg: '#CCCCCC' }),
      Text({ content: stock.symbol, width: 10, fg: symbolColor }),
      Text({ content: this.truncateName(stock.name, 19), width: 20, fg: '#888888' }),
      Text({ content: stock.price.amount.toFixed(2), width: 10, fg: '#FFFFFF' }),
      Text({ content: stock.formattedPriceChange, width: 8, fg: changeColor }),
      Text({ content: qtyText, width: HEADER_WIDTH_QUANTITY, fg: hasPosition ? '#FFFFFF' : '#666666' }),
      Text({ content: investedText, width: HEADER_WIDTH_INVESTED, fg: hasTransactions ? '#888888' : '#666666' }),
      Text({ content: valueText, width: HEADER_WIDTH_VALUE, fg: hasPosition ? '#FFFFFF' : '#666666' }),
      Text({ content: unrealText, width: HEADER_WIDTH_VALUE, fg: hasPosition ? unrealColor : '#666666' }),
      Text({ content: realText, width: 10, fg: hasTransactions && pos.realizedPL !== 0 ? realColor : '#666666' }),
      buttonSpacer,
      buyBtn,
      buttonSpacer,
      sellBtn,
      buttonSpacer,
      detailsBtn,
      buttonSpacer,
      deleteBtn
    );
  }

  private createPurchaseHistoryPanel(symbol: string): any {
    const position = this.getPosition(symbol);
    if (!position || !this.expandedSymbols.has(symbol)) {
      return null;
    }

    const stock = this.marketData?.stocks.find(s => s.symbol === symbol);
    const currencySymbol = stock?.price.currency === 'EUR' ? '€' : (stock?.price.currency || '$');
    const transactionsWithPL = calculateTransactionsWithPL(position.transactions, stock?.price.amount || 0);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const formatDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      }
      return dateStr;
    };

    const transactionRows = transactionsWithPL.map((t) => {
      const plColor = t.pl >= 0 ? '#00FF00' : '#FF0000';
      const plSign = t.pl >= 0 ? '+' : '';
      const typeColor = t.type === 'BUY' ? '#00FF00' : '#FF8888';
      const typeLabel = t.type === 'BUY' ? 'BUY' : 'SELL';
      return Box(
        {
          width: '100%',
          flexDirection: 'row',
          paddingLeft: 2
        },
        Text({ content: formatDate(t.date), width: 14, fg: '#AAAAAA' }),
        Text({ content: typeLabel, width: 7, fg: typeColor }),
        Text({ content: `${currencySymbol}${t.pricePerShare.toFixed(2)}`, width: 12, fg: '#888888' }),
        Text({ content: String(t.qty), width: 10, fg: '#FFFFFF' }),
        Text({ content: `${plSign}${currencySymbol}${t.pl.toFixed(0)}`, width: 12, fg: plColor }),
        Text({ content: `${plSign}${t.plPercent.toFixed(2)}%`, width: 8, fg: plColor }),
        Text({ content: `${currencySymbol}${t.currentValue.toFixed(0)}`, width: 12, fg: '#FFFFFF' })
      );
    });

    const headerRow = Box(
      {
        width: '100%',
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        paddingLeft: 2
      },
      Text({ content: 'Date', width: 14, fg: '#666666' }),
      Text({ content: 'Type', width: 7, fg: '#666666' }),
      Text({ content: 'Price', width: 12, fg: '#666666' }),
      Text({ content: 'Qty', width: 10, fg: '#666666' }),
      Text({ content: 'Gain', width: 12, fg: '#666666' }),
      Text({ content: '%', width: 8, fg: '#666666' }),
      Text({ content: 'Value', width: 12, fg: '#666666' })
    );

    return Box(
      {
        width: '100%',
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#444444',
        backgroundColor: '#0a0a0a',
        padding: 0
      },
      headerRow,
      ...transactionRows
    );
  }

  /**
   * Create footer component
   */
  private createFooter(status: AppStatus) {
    const lastUpdate = status.lastUpdate ? 
      `Last: ${status.lastUpdate.toLocaleTimeString()}` : 'Never';

    return Box(
      {
        width: '100%',
        height: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      },
      Text({
        content: lastUpdate,
        fg: '#CCCCCC'
      }),
      Text({
        content: 'Press Ctrl+C to exit',
        fg: '#CCCCCC'
      })
    );
  }

  /**
   * Get status indicator text
   */
  private getStatusIndicator(status: AppStatus): string {
    if (status.isLoading) return '🔄 UPDATING';
    if (status.hasError) return '❌ ERROR';
    if (status.isConnected) return '🟢 LIVE';
    return '🔴 OFFLINE';
  }

  /**
   * Get color for market sentiment
   */
  private getSentimentColor(sentiment: string): string {
    switch (sentiment) {
      case 'BULLISH': return '#00FF00';
      case 'BEARISH': return '#FF0000';
      default: return '#FFA500';
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isInitialized) {
      // Clean up resize timeout
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      // Remove resize event listeners
      if (process.stdout && process.stdout.removeListener) {
        process.stdout.removeListener('resize', this.handleResize);
      }
      if (process.removeListener) {
        process.removeListener('SIGWINCH', this.handleResize);
      }
      
      // Cleanup search panel
      if (this.searchPanel) {
        this.searchPanel.destroy();
        this.searchPanel = null;
      }
      
      console.log('🧹 Renderer cleaned up');
    }
  }

  // ========== Portfolio Management ==========

  loadPortfolio(): Position[] {
    this.positions = this.portfolioStore.load();
    console.log(`📂 Loaded ${this.positions.length} positions from portfolio`);
    return this.positions;
  }

  private savePortfolio(): void {
    this.portfolioStore.save(this.positions);
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.find(p => p.symbol === symbol);
  }

  getPositions(): Position[] {
    return this.positions;
  }

  getSavedSymbols(): { symbol: string; name: string }[] {
    return this.positions.map(p => ({ symbol: p.symbol, name: p.name }));
  }

  addSymbol(symbol: string, name: string): void {
    const existing = this.positions.find(p => p.symbol === symbol);
    if (!existing) {
      this.positions = [...this.positions, { symbol, name, transactions: [] }];
      this.savePortfolio();
      console.log(`💾 Added ${symbol} to portfolio`);
    }
  }

  // ========== Position Calculations ==========

  private calculatePositionSummary(symbol: string, currentPrice: number) {
    const position = this.getPosition(symbol);
    if (!position || position.transactions.length === 0) {
      return { qty: 0, totalInvested: 0, avgCost: 0, currentValue: 0, unrealizedPL: 0, unrealizedPLPercent: 0, realizedPL: 0 };
    }
    const summary = calculatePositionSummary(position.transactions, currentPrice);
    return summary;
  }

  getPortfolioTotal(): { value: number; invested: number; pl: number; plPercent: number } {
    let totalValue = 0;
    let totalInvested = 0;
    
    for (const position of this.positions) {
      const stock = this.marketData?.getStock(position.symbol);
      const currentPrice = stock?.price.amount || 0;
      const summary = this.calculatePositionSummary(position.symbol, currentPrice);
      
      totalValue += summary.currentValue;
      totalInvested += summary.totalInvested;
    }
    
    const pl = totalValue - totalInvested;
    const plPercent = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;
    
    return { value: totalValue, invested: totalInvested, pl, plPercent };
  }

  // ========== Dialog Methods ==========

  private scheduleDateChangeFetch(): void {
    if (this.dialogFetchTimer) {
      clearTimeout(this.dialogFetchTimer);
    }
    this.dialogFetchTimer = setTimeout(() => {
      this.fetchHistoricalPrice();
    }, 1000);
  }

  private incrementDay(): void {
    const daysInMonth = new Date(this.dialogYear, this.dialogMonth + 1, 0).getDate();
    this.dialogDay++;
    if (this.dialogDay > daysInMonth) {
      this.dialogDay = 1;
      this.incrementMonth();
    }
    this.scheduleDateChangeFetch();
  }

  private decrementDay(): void {
    const daysInPrevMonth = new Date(this.dialogYear, this.dialogMonth, 0).getDate();
    this.dialogDay--;
    if (this.dialogDay < 1) {
      this.dialogDay = daysInPrevMonth;
      this.decrementMonth();
    }
    this.scheduleDateChangeFetch();
  }

  private incrementMonth(): void {
    this.dialogMonth++;
    if (this.dialogMonth > 11) {
      this.dialogMonth = 0;
      this.dialogYear++;
    }
    const daysInMonth = new Date(this.dialogYear, this.dialogMonth + 1, 0).getDate();
    if (this.dialogDay > daysInMonth) {
      this.dialogDay = daysInMonth;
    }
    this.scheduleDateChangeFetch();
  }

  private decrementMonth(): void {
    this.dialogMonth--;
    if (this.dialogMonth < 0) {
      this.dialogMonth = 11;
      this.dialogYear--;
    }
    const daysInMonth = new Date(this.dialogYear, this.dialogMonth + 1, 0).getDate();
    if (this.dialogDay > daysInMonth) {
      this.dialogDay = daysInMonth;
    }
    this.scheduleDateChangeFetch();
  }

  private incrementYear(): void {
    this.dialogYear++;
    const daysInMonth = new Date(this.dialogYear, this.dialogMonth + 1, 0).getDate();
    if (this.dialogDay > daysInMonth) {
      this.dialogDay = daysInMonth;
    }
    this.scheduleDateChangeFetch();
  }

  private decrementYear(): void {
    this.dialogYear--;
    const daysInMonth = new Date(this.dialogYear, this.dialogMonth + 1, 0).getDate();
    if (this.dialogDay > daysInMonth) {
      this.dialogDay = daysInMonth;
    }
    this.scheduleDateChangeFetch();
  }

  openBuyDialog(symbol: string): void {
    this.dialogMode = 'buy';
    this.dialogSymbol = symbol;
    this.dialogYear = new Date().getFullYear();
    this.dialogMonth = new Date().getMonth();
    this.dialogDay = new Date().getDate();
    this.dialogQty = '';
    
    const stock = this.marketData?.stocks.find(s => s.symbol === symbol);
    this.dialogPrice = stock ? stock.price.amount.toFixed(2) : '';
    this.dialogUseDayPrice = false;
    this.dialogFetchingPrice = false;
    
    this.renderWithCurrentStatus();
  }

  openSellDialog(symbol: string): void {
    this.dialogMode = 'sell';
    this.dialogSymbol = symbol;
    this.dialogYear = new Date().getFullYear();
    this.dialogMonth = new Date().getMonth();
    this.dialogDay = new Date().getDate();
    this.dialogQty = '';
    
    const stock = this.marketData?.stocks.find(s => s.symbol === symbol);
    this.dialogPrice = stock ? stock.price.amount.toFixed(2) : '';
    this.dialogUseDayPrice = false;
    this.dialogFetchingPrice = false;
    
    this.renderWithCurrentStatus();
  }

  closeDialog(): void {
    this.dialogMode = 'none';
    this.dialogSymbol = '';
    this.renderWithCurrentStatus();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async confirmBuy(): Promise<void> {
    const qty = parseInt(this.dialogQty, 10);
    const price = parseFloat(this.dialogPrice);

    if (isNaN(qty) || qty <= 0) {
      return;
    }
    if (isNaN(price) || price <= 0) {
      return;
    }

    const stock = this.marketData?.stocks.find(s => s.symbol === this.dialogSymbol);
    const name = stock?.name || this.dialogSymbol;
    const dateStr = `${this.dialogYear}-${String(this.dialogMonth + 1).padStart(2, '0')}-${String(this.dialogDay).padStart(2, '0')}`;

    const transaction: Transaction = {
      id: this.generateId(),
      type: 'BUY',
      date: dateStr,
      qty,
      pricePerShare: price
    };

    this.positions = this.portfolioStore.addTransaction(this.dialogSymbol, name, transaction, this.positions);
    this.savePortfolio();
    this.closeDialog();
  }

  async confirmSell(): Promise<void> {
    const qty = parseInt(this.dialogQty, 10);
    const price = parseFloat(this.dialogPrice);

    if (isNaN(qty) || qty <= 0) {
      return;
    }
    if (isNaN(price) || price <= 0) {
      return;
    }

    const position = this.getPosition(this.dialogSymbol);
    if (!position) {
      return;
    }

    // Calculate current holdings (BUY - SELL)
    const totalBuys = position.transactions
      .filter(t => t.type === 'BUY')
      .reduce((sum, t) => sum + t.qty, 0);
    const totalSells = position.transactions
      .filter(t => t.type === 'SELL')
      .reduce((sum, t) => sum + t.qty, 0);
    const currentQty = totalBuys - totalSells;

    if (currentQty < qty) {
      return;
    }

    const stock = this.marketData?.stocks.find(s => s.symbol === this.dialogSymbol);
    const name = stock?.name || this.dialogSymbol;
    const dateStr = `${this.dialogYear}-${String(this.dialogMonth + 1).padStart(2, '0')}-${String(this.dialogDay).padStart(2, '0')}`;

    const transaction: Transaction = {
      id: this.generateId(),
      type: 'SELL',
      date: dateStr,
      qty,
      pricePerShare: price
    };

    this.positions = this.portfolioStore.addTransaction(this.dialogSymbol, name, transaction, this.positions);
    this.savePortfolio();
    this.closeDialog();
  }

  async fetchHistoricalPrice(): Promise<void> {
    if (!this.dialogSymbol || this.dialogFetchingPrice) return;

    const dateStr = `${this.dialogYear}-${String(this.dialogMonth + 1).padStart(2, '0')}-${String(this.dialogDay).padStart(2, '0')}`;

    this.dialogFetchingPrice = true;
    this.renderWithCurrentStatus();

    const price = await this.historicalPriceService.getPriceOnDate(this.dialogSymbol, dateStr);

    this.dialogFetchingPrice = false;
    if (price !== null) {
      this.dialogPrice = price.toFixed(2);
    }
    this.renderWithCurrentStatus();
  }

  private createTransactionDialog(): any {
    if (this.dialogMode === 'none') return null;

    const isBuy = this.dialogMode === 'buy';
    const symbol = this.dialogSymbol;
    const stock = this.marketData?.stocks.find(s => s.symbol === symbol);
    const title = isBuy ? `BUY: ${symbol}` : `SELL: ${symbol}`;
    const titleColor = isBuy ? '#00FF88' : '#FF6666';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const loading = this.dialogFetchingPrice;

    const qtyInput = Input({ width: 10, maxLength: 8, placeholder: '0', value: this.dialogQty });
    qtyInput.on(InputRenderableEvents.INPUT, (value: string) => { this.dialogQty = value; });
    if (!loading) setTimeout(() => { qtyInput.focus(); }, 0);

    const priceInput = Input({ width: 12, maxLength: 10, placeholder: '0.00', value: this.dialogPrice });
    priceInput.on(InputRenderableEvents.INPUT, (value: string) => { this.dialogPrice = value; });

    const okBtnBg = loading ? '#333333' : '#004400';
    const okBtnFg = loading ? '#666666' : '#00FF00';
    const okBtnText = loading ? ' Loading... ' : '  [OK]  ';

    const arrowBtn = (label: string, onClick: () => void, disabled: boolean) => {
      const bg = disabled ? '#333333' : '#222244';
      const fg = disabled ? '#444444' : '#00AAFF';
      return Box(
        {
          width: label.includes(']') ? 2 : 2,
          height: 1,
          backgroundColor: bg,
          onMouseDown: disabled ? undefined : ((e: any) => { e.stopPropagation(); onClick(); this.renderWithCurrentStatus(); })
        },
        Text({ content: label, width: 2, fg })
      );
    };

    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return Box(
      {
        id: 'transaction-dialog',
        width: 55,
        flexDirection: 'column',
        borderStyle: 'double',
        borderColor: titleColor,
        backgroundColor: '#08081a',
        padding: 1,
        zIndex: 100
      },
      Text({ content: title, fg: titleColor }),
      Box({ width: '100%', height: 1 }),

      Box(
        { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 0 },
        Text({ content: 'Date: ', width: 6, fg: '#888888' }),
        arrowBtn('<', () => this.decrementMonth(), loading),
        Text({ content: shortMonths[this.dialogMonth], width: 4, fg: '#FFFFFF' }),
        arrowBtn('>', () => this.incrementMonth(), loading),
        Box({ width: 2 }),
        arrowBtn('<', () => this.decrementDay(), loading),
        Text({ content: String(this.dialogDay).padStart(2, '0'), width: 3, fg: '#FFFFFF' }),
        arrowBtn('>', () => this.incrementDay(), loading),
        Box({ width: 2 }),
        arrowBtn('<', () => this.decrementYear(), loading),
        Text({ content: String(this.dialogYear), width: 5, fg: '#FFFFFF' }),
        arrowBtn('>', () => this.incrementYear(), loading)
      ),
      Box({ width: '100%', height: 1 }),

      Box(
        { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 1 },
        Text({ content: 'Qty: ', width: 5, fg: '#888888' }),
        qtyInput
      ),
      Box({ width: '100%', height: 1 }),

      Box(
        { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 1 },
        Text({ content: 'Price: ', width: 6, fg: '#888888' }),
        priceInput
      ),
      Box({ width: '100%', height: 1 }),

      Box(
        { flexDirection: 'row', gap: 10 },
        Box(
          {
            width: 9,
            height: 1,
            backgroundColor: '#440000',
            onMouseDown: (e: any) => { e.stopPropagation(); this.closeDialog(); }
          },
          Text({ content: ' [Cancel] ', width: 9, fg: '#FF4444' })
        ),
        Box(
          {
            width: 9,
            height: 1,
            backgroundColor: okBtnBg,
            onMouseDown: loading ? undefined : ((e: any) => { e.stopPropagation(); isBuy ? this.confirmBuy() : this.confirmSell(); })
          },
          Text({ content: okBtnText, width: 9, fg: okBtnFg })
        )
      )
    );
  }
}