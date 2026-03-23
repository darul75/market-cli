#!/usr/bin/env bun

import { StockMonitorApp } from './application/StockMonitorApp.js';
import { TerminalRenderer, LoadingProgress } from './infrastructure/TerminalRenderer.js';
import { progressTracker, ProgressUpdate } from './shared/ProgressTracker.js';
import { combineLatest } from 'rxjs';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log('🚀 Starting CAC40 Live Monitor...\n');
  
  let app: StockMonitorApp | null = null;
  let renderer: TerminalRenderer | null = null;
  let currentProgress: ProgressUpdate | null = null;

  try {
    // Initialize components
    app = new StockMonitorApp();
    renderer = new TerminalRenderer();
    
    // Initialize OpenTUI renderer
    console.log('🎨 Initializing terminal interface...');
    await renderer.initialize();
    
    // Set up search service
    const currentApp = app;
    renderer.setupSearchService(
      currentApp.getSearchService(),
      async (symbol: string, name: string) => {
        console.log(`\n✅ Adding ${symbol} (${name}) to watchlist...`);
        await currentApp.addStock(symbol, name);
      }
    );
    
    // Set up progress tracking
    const progressListener = (progress: ProgressUpdate) => {
      currentProgress = progress;
      if (renderer) {
        const loadingProgress: LoadingProgress = {
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
          completedStocks: progress.completedStocks,
          totalStocks: progress.totalStocks,
          currentBatchStocks: progress.currentSymbol ? 
            [...progress.currentBatchStocks.filter(s => s !== progress.currentSymbol), `⏳ ${progress.currentSymbol}`] : 
            progress.currentBatchStocks,
          successCount: progress.successCount,
          errorCount: progress.errorCount,
          recentErrors: progress.recentErrors,
          elapsedTime: progress.elapsedTime
        };
        renderer.renderLoading(loadingProgress);
      }
    };
    
    progressTracker.addListener(progressListener);
    
    // Start the application
    console.log('📊 Starting data streams...');
    const { marketData$, status$ } = app.start();
    
    // Show initial loading state
    renderer.renderLoading();
    
    console.log('✅ Application started successfully!');
    console.log('📈 Fetching live CAC40 data...\n');
    
    // Subscribe to reactive streams and update UI
    combineLatest([marketData$, status$]).subscribe({
      next: ([marketData, status]) => {
        try {
          if (status.isLoading && !marketData) {
            // Progress will be handled by the progress tracker listener
            if (!currentProgress) {
              renderer!.renderLoading();
            }
          } else if (status.hasError && status.error) {
            // Show error state - no fallback data rendering
            progressTracker.removeListener(progressListener);
            renderer!.renderError(status.error);
          } else if (marketData && !status.hasError) {
            // Show actual data
            progressTracker.removeListener(progressListener);
            renderer!.renderStockTable(marketData, status);
          }
        } catch (renderError) {
          console.error('🎨 Rendering error:', renderError);
        }
      },
      error: (error) => {
        progressTracker.removeListener(progressListener);
        console.error('💥 Application error:', error);
        if (renderer) {
          renderer.renderError(error.message || 'Unknown error occurred');
        }
      }
    });

  } catch (error) {
    console.error('❌ Failed to start application:', error);
    
    if (renderer) {
      renderer.renderError(
        error instanceof Error ? error.message : 'Failed to initialize application'
      );
    }
    
    process.exit(1);
  }

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\n🛑 Shutting down...');
    
    progressTracker.reset();
    
    if (app) {
      app.stop();
    }
    
    if (renderer) {
      renderer.destroy();
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
  };

  // Handle Ctrl+C and other termination signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGQUIT', shutdown);
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    if (renderer) {
      renderer.renderError('Fatal error: ' + error.message);
    }
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled promise rejection:', reason);
    if (renderer) {
      renderer.renderError('Promise rejection: ' + String(reason));
    }
  });
}

// Run the application only if this file is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 Fatal startup error:', error);
    process.exit(1);
  });
}

export { main };