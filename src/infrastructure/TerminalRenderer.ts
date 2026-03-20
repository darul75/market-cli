import { createCliRenderer, Box, Text, CliRenderer, ScrollBox } from '@opentui/core';
import { Stock, MarketData } from '../domain/index.js';
import { AppStatus } from '../application/StockMonitorApp.js';

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
  private scrollPosition = 0; // Track scroll position for preservation during refresh
  private resizeTimeout?: NodeJS.Timeout; // For debounced resize handling
  private relativeScrollPosition = 0; // Relative scroll position (0-1) for resize preservation

  /**
   * Initialize the renderer
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎨 Initializing OpenTUI renderer...');
      this.renderer = await createCliRenderer({
        exitOnCtrlC: true
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
   * Calculate and store relative scroll position (0.0 to 1.0)
   */
  private calculateRelativeScrollPosition(totalStocks: number): void {
    if (totalStocks <= 0) {
      this.relativeScrollPosition = 0;
      return;
    }
    
    // Calculate relative position based on current scroll and total content
    this.relativeScrollPosition = Math.min(1.0, Math.max(0.0, this.scrollPosition / totalStocks));
  }

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
   * Clear the screen before rendering new content
   */
  private clearScreen(): void {
    if (!this.isInitialized) return;
    
    // Remove all existing children from the root
    const children = this.renderer.root.getChildren();
    children.forEach(child => {
      if (child.id) {
        this.renderer.root.remove(child.id);
      }
    });
  }

  /**
   * Render the main stock monitoring interface
   */
  renderStockTable(marketData: MarketData, status: AppStatus): void {
    if (!this.isInitialized) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    // Clear previous content first
    this.clearScreen();

    // Create and add main container to root
    this.renderer.root.add(
      Box(
        {
          width: '100%',
          height: '100%', // Use full terminal height
          flexDirection: 'column',
          padding: 1
        },
        // Header
        this.createHeader(status),
        // Market summary
        this.createMarketSummary(marketData),
        // Stock table (with flexible ScrollBox inside)
        this.createStockTable(marketData.stocks),
        // Footer
        this.createFooter(status)
      )
    );
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
        content: '🔄 Loading CAC40 Data...',
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
        padding: 1,
        flexDirection: 'column'
      },
      Box(
        {
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        },
        Text({
          content: '📈 CAC40 Live Monitor',
          fg: '#00FF00'
        }),
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
        height: 2,
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
      this.createStockRow(stock, index + 1, index % 2 === 0)
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
      Text({ content: 'Volume', width: 10, fg: '#FFFFFF' })
    );
  }

  /**
   * Create individual stock row with zebra striping
   */
  private createStockRow(stock: Stock, index: number, isEvenRow: boolean = false) {
    // Truncate name if too long
    const truncatedName = stock.name.length > 18 ? 
      stock.name.substring(0, 18) + '..' : stock.name;
    
    const changeColor = stock.isPositive ? '#00FF00' : '#FF0000';
    
    // Zebra stripe background colors using terminal-friendly colors
    const backgroundColor = isEvenRow ? '#2a2a2a' : '#1a1a1a';

    return Box(
      {
        width: '100%',
        height: 1,
        flexDirection: 'row',
        padding: 1,
        backgroundColor
      },
      Text({ content: index.toString(), width: 3, fg: '#CCCCCC' }),
      Text({ content: stock.symbol, width: 12, fg: '#00BFFF' }),
      Text({ content: truncatedName, width: 20, fg: '#FFFFFF' }),
      Text({ content: stock.price.toString(), width: 10, fg: '#FFFFFF' }),
      Text({ content: stock.formattedPriceChange, width: 8, fg: changeColor }),
      Text({ content: stock.formattedPercentageChange, width: 8, fg: changeColor }),
      Text({ content: stock.formattedVolume, width: 10, fg: '#CCCCCC' })
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
      
      console.log('🧹 Renderer cleaned up');
    }
  }
}