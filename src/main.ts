#!/usr/bin/env bun

import { StockMonitorApp } from "./application/StockMonitorApp.js";
import { TerminalRenderer, type LoadingProgress } from "./infrastructure/TerminalRenderer.js";
import { debugLog } from "./shared/Logger.js";
import { progressTracker, type ProgressUpdate } from "./shared/ProgressTracker.js";
import { combineLatest } from "rxjs";

async function main(): Promise<void> {
	let app: StockMonitorApp | null = null;
	let renderer: TerminalRenderer | null = null;
	let currentProgress: ProgressUpdate | null = null;

	try {
		app = new StockMonitorApp();
		renderer = new TerminalRenderer();

		await renderer.initialize();

		renderer.setDataStream(app.getDataStream());

		await renderer.updateExchangeRate();

		const positions = await renderer.loadPortfolio();
		const symbols = positions.map((p) => p.symbol);

		const currentApp = app;
		const currentRenderer = renderer;
		renderer.setupSearchService(currentApp.getSearchService(), async (symbol: string, name: string) => {
			currentRenderer.addSymbol(symbol, name);
			await currentApp.addStock(symbol);
		});

		const progressListener = (progress: ProgressUpdate) => {
			currentProgress = progress;
			if (renderer) {
				const loadingProgress: LoadingProgress = {
					currentBatch: progress.currentBatch,
					totalBatches: progress.totalBatches,
					completedStocks: progress.completedStocks,
					totalStocks: progress.totalStocks,
					currentBatchStocks: progress.currentSymbol
						? [
								...progress.currentBatchStocks.filter((s) => s !== progress.currentSymbol),
								`⏳ ${progress.currentSymbol}`,
							]
						: progress.currentBatchStocks,
					successCount: progress.successCount,
					errorCount: progress.errorCount,
					recentErrors: progress.recentErrors,
					elapsedTime: progress.elapsedTime,
				};
				renderer.renderLoading(loadingProgress);
			}
		};

		progressTracker.addListener(progressListener);

		renderer.renderLoading();

		const { marketData$, status$ } = app.start(symbols);

		combineLatest([marketData$, status$]).subscribe({
			next: async ([marketData, status]) => {
				try {
					if (status.isLoading && !marketData && renderer) {
						if (!currentProgress) {
							renderer.renderLoading();
						}
					} else if (status.hasError && status.error && renderer) {
						progressTracker.removeListener(progressListener);
						renderer.renderError(status.error);
					} else if (marketData && renderer) {
						progressTracker.removeListener(progressListener);
						renderer.setStatus(status);
						if (renderer) {
							renderer.data = marketData;
						}
						renderer?.render();
					}
				} catch (renderError) {
					console.error("🎨 Rendering error:", renderError);
				}
			},
			error: (error) => {
				progressTracker.removeListener(progressListener);
				console.error("💥 Application error:", error);
				if (renderer) {
					renderer.renderError(error.message || "Unknown error occurred");
				}
			},
		});
	} catch (error) {
		console.error("❌ Failed to start application:", error);

		if (renderer) {
			renderer.renderError(error instanceof Error ? error.message : "Failed to initialize application");
		}

		process.exit(1);
	}

	const shutdown = () => {
		progressTracker.reset();

		if (app) {
			app.stop();
		}

		if (renderer) {
			renderer.destroy();
		}

		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("SIGQUIT", shutdown);

	process.on("uncaughtException", (error) => {
		debugLog(`💥 Uncaught exception: ${error}`);
		if (renderer) {
			renderer.renderError(`Fatal error: ${error.message}`);
		}
		setTimeout(() => process.exit(1), 1000);
	});

	process.on("unhandledRejection", (reason) => {
		debugLog(`💥 Unhandled promise rejection: ${reason}`);
		if (renderer) {
			renderer.renderError(`Promise rejection: ${String(reason)}`);
		}
	});
}

if (import.meta.main) {
	main().catch((error) => {
		debugLog(`💥 Fatal startup error: ${error}`);
		process.exit(1);
	});
}

export { main };
