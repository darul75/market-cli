import { createCliRenderer, Box, Text, CliRenderer, ScrollBox, Input, InputRenderableEvents } from '@opentui/core';
import { Stock, MarketData } from '../domain/index.js';
import { AppStatus, SearchService } from '../application/index.js';
import { SearchPanel } from './search/index.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/marker-cli-debug.log', `[${new Date().toISOString()}] TerminalRenderer: ${msg}\n`);
  } catch {}
}

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

  // Portfolio tracking: share quantities per symbol
  private stockQuantities: Map<string, number> = new Map();
  private editingSymbol: string | null = null;
  private editingInputValue: string = '';


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
    // Don't do anything if already at top
    if (index <= 0) return;
    
    // Swap with previous element
    const temp = this.marketData!.stocks[index];
    this.marketData!.stocks[index] = this.marketData!.stocks[index - 1];
    this.marketData!.stocks[index - 1] = temp;
    
    // Update selection to follow moved item
    this.selectedIndex = index - 1;
    
    // Re-render
    this.renderWithCurrentStatus();
  }

  /**
   * Handle move down action
   */
  private handleMoveDown(index: number): void {
    // Don't do anything if already at bottom
    if (index >= this.marketData!.stocks.length - 1) return;
    
    // Swap with next element
    const temp = this.marketData!.stocks[index];
    this.marketData!.stocks[index] = this.marketData!.stocks[index + 1];
    this.marketData!.stocks[index + 1] = temp;
    
    // Update selection to follow moved item
    this.selectedIndex = index + 1;
    
    // Re-render
    this.renderWithCurrentStatus();
  }

  /**
   * Handle delete action
   */
  private handleDelete(index: number): void {
    // Remove stock from array
    this.marketData!.stocks.splice(index, 1);
    
    // Adjust selection if needed
    if (this.selectedIndex >= this.marketData!.stocks.length) {
      this.selectedIndex = Math.max(0, this.marketData!.stocks.length - 1);
    }
    
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
      this.createSearchPanel(),
      this.createPortfolioSummary(),
      this.createFooter(status)
    );

    this.renderer.root.add(
      Box(
        { width: '100%', height: '100%', flexDirection: 'column', padding: 1 },
        content
      )
    );

    if (this.editingSymbol) {
      // True overlay: absolutely positioned full-screen wrapper centers the dialog
      this.renderer.root.add(
        Box(
          {
            id: 'qty-dialog-overlay',
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
          this.createQtyDialog()
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
    
    // Create scrollable stock rows with zebra striping
    const stockRows = stocks.map((stock, index) => 
      this.createStockRow(stock, index + 1, index % 2 === 0, index === this.selectedIndex)
    );

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
      ...stockRows
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
      Text({ content: '#', width: 3, fg: '#FFFFFF' }),
      Text({ content: 'Symbol', width: 12, fg: '#FFFFFF' }),
      Text({ content: 'Name', width: 20, fg: '#FFFFFF' }),
      Text({ content: 'Price', width: 10, fg: '#FFFFFF' }),
      Text({ content: 'Change', width: 8, fg: '#FFFFFF' }),
      Text({ content: '%Change', width: 8, fg: '#FFFFFF' }),
      Text({ content: 'Volume', width: 10, fg: '#FFFFFF' }),
      Text({ content: 'Qty', width: 8, fg: '#FFFFFF' }),
      Text({ content: 'Actions', width: 15, fg: '#AAAAFF' })
    );
  }

  /**
   * Create individual stock row with zebra striping and selection support
   */
  private createStockRow(stock: Stock, index: number, isEvenRow: boolean = false, isSelected: boolean = false) {
    // Truncate name if too long
    const truncatedName = stock.name.length > 18 ? 
      stock.name.substring(0, 18) + '..' : stock.name;
    
    const changeColor = stock.isPositive ? '#00FF00' : '#FF0000';
    
    // Determine background color based on selection state
    let backgroundColor: string;
    if (isSelected) {
      backgroundColor = '#0055AA'; // Blue background for selected row
    } else {
      backgroundColor = isEvenRow ? '#2a2a2a' : '#1a1a1a'; // Zebra striping
    }
    
    // Brighter symbol color when selected
    const symbolColor = isSelected ? '#00FFFF' : '#00BFFF';
    const qty = this.stockQuantities.get(stock.symbol);
    
    // Create action buttons (only visible when selected)
    const moveUpButton = this.createActionButton('🔼', '#00FF00', () => this.handleMoveUp(index - 1), isSelected, !qty || qty === 0 ? 4: 2);
    const moveDownButton = this.createActionButton('🔽', '#FFFF00', () => this.handleMoveDown(index - 1), isSelected);
    const deleteButton = this.createActionButton('❌', '#FF0000', () => this.handleDelete(index - 1), isSelected);
    
    // Spacer between buttons
    const buttonSpacer = Box(
      {
        width: 1,
        height: 1,
        backgroundColor: 'transparent',
      },
      Text({ content: ' ', width: 1 })
    );

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
          if (this.editingSymbol !== null) return; // dialog is open, ignore row clicks
          if (event.button === 0) {
            this.handleRowClick(stock, index - 1);
          }
        }
      },
      Text({ content: index.toString(), width: 3, fg: '#CCCCCC' }),
      Text({ content: stock.symbol, width: 12, fg: symbolColor }),
      Text({ content: truncatedName, width: 20, fg: '#FFFFFF' }),
      Text({ content: stock.price.toString(), width: 10, fg: '#FFFFFF' }),
      Text({ content: stock.formattedPriceChange, width: 8, fg: changeColor }),
      Text({ content: stock.formattedPercentageChange, width: 8, fg: changeColor }),
      Text({ content: stock.formattedVolume, width: 6, fg: '#CCCCCC' }),
      this.createQtySection(stock.symbol, isSelected),
      buttonSpacer,
      moveUpButton,
      buttonSpacer,
      moveDownButton,
      buttonSpacer,
      deleteButton
    );
  }

  /**
   * Qty display + edit button for a stock row (display-only; editing via dialog).
   */
  private createQtySection(symbol: string, isSelected: boolean): any {
    const qty = this.stockQuantities.get(symbol);
    const qtyText = qty !== undefined ? `x${qty}`.padStart(6) : '      ';

    const editBtn = this.createActionButton('✏️', '#AAAAFF', () => {
        this.editingSymbol = symbol;
        this.editingInputValue = qty !== undefined ? qty.toString() : '';
        this.renderWithCurrentStatus();
      },
      isSelected
    );

    if (qty && qty > 0) {
      
    }

    return Box(
      { width: 8, height: 1, flexDirection: 'row', alignItems:'center', marginLeft: qty && qty > 0 ? 2 : 0 },
      Text({ content: qtyText, width: 6, fg: '#AAAAFF' }),
      editBtn,
      Box({ width: 1, height: 1 }, Text({ content: ' ', width: 1 }))
    );
  }

  private createQtyDialog(): any {
    if (!this.editingSymbol) return null;

    const symbol = this.editingSymbol;
    const stock = this.marketData?.stocks.find(s => s.symbol === symbol);
    const currentQty = this.stockQuantities.get(symbol);
    const initialValue = currentQty !== undefined ? currentQty.toString() : '';

    const input = Input({ width: 12, maxLength: 8, placeholder: '0', value: initialValue });

    input.on(InputRenderableEvents.INPUT, (value: string) => {
      this.editingInputValue = value;
    });

    setTimeout(() => {
      input.focus();
      if (initialValue) input.gotoLineEnd();
    }, 0);

    const confirmAndClose = () => {
      const qty = parseInt(this.editingInputValue, 10);
      if (!Number.isNaN(qty) && qty >= 0) {
        if (qty === 0) {
          this.stockQuantities.delete(symbol);
        } else {
          this.stockQuantities.set(symbol, qty);
        }
      }
      this.editingSymbol = null;
      this.editingInputValue = '';
      this.renderWithCurrentStatus();
    };

    input.on(InputRenderableEvents.ENTER, confirmAndClose);

    const priceStr = stock ? `  ${stock.price.toString()}` : '';

    const okBtn = Box(
      {
        width: 8, height: 1, backgroundColor: '#004400',
        onMouseDown: (e: any) => { e.stopPropagation(); confirmAndClose(); }
      },
      Text({ content: '  [OK]  ', width: 8, fg: '#00FF00' })
    );

    const cancelBtn = Box(
      {
        width: 10, height: 1, backgroundColor: '#440000',
        onMouseDown: (e: any) => {
          e.stopPropagation();
          this.editingSymbol = null;
          this.editingInputValue = '';
          this.renderWithCurrentStatus();
        }
      },
      Text({ content: ' [Cancel] ', width: 10, fg: '#FF4444' })
    );

    return Box(
      {
        id: 'qty-dialog',
        width: 52,
        flexDirection: 'column',
        borderStyle: 'double',
        borderColor: '#AAAAFF',
        backgroundColor: '#08081a',
        padding: 1,
        zIndex: 100
      },
      Text({ content: `Set quantity — ${symbol}${priceStr}`, fg: '#AAAAFF' }),
      Box(
        { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 1 },
        Text({ content: 'Shares: ', width: 8, fg: '#888888' }),
        input,
        okBtn,
        cancelBtn
      )
    );
  }

  /**
   * Portfolio value summary bar — shown only when any quantities are set.
   */
  private createPortfolioSummary(): any {
    if (this.stockQuantities.size === 0 || !this.marketData) return null;

    let total = 0;
    let currency = 'EUR';
    let positionsCount = 0;

    for (const stock of this.marketData.stocks) {
      const qty = this.stockQuantities.get(stock.symbol);
      if (qty !== undefined && qty > 0) {
        total += qty * stock.price.amount;
        currency = stock.price.currency;
        positionsCount++;
      }
    }

    if (positionsCount === 0) return null;

    const currencySymbol = currency === 'EUR' ? '€' : currency;
    const totalStr = `${currencySymbol}${total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return Box(
      {
        width: '100%',
        height: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 1,
        backgroundColor: '#111122'
      },
      Text({ content: `Portfolio (${positionsCount} position${positionsCount > 1 ? 's' : ''}):  `, fg: '#888888' }),
      Text({ content: totalStr, fg: '#00FF88' })
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
}