/**
 * Global progress tracker for API operations
 */
export interface ProgressUpdate {
	currentBatch: number;
	totalBatches: number;
	completedStocks: number;
	totalStocks: number;
	currentBatchStocks: string[];
	successCount: number;
	errorCount: number;
	recentErrors: string[];
	elapsedTime: number;
	currentSymbol?: string;
}

class GlobalProgressTracker {
	private progress: ProgressUpdate = {
		currentBatch: 0,
		totalBatches: 0,
		completedStocks: 0,
		totalStocks: 0,
		currentBatchStocks: [],
		successCount: 0,
		errorCount: 0,
		recentErrors: [],
		elapsedTime: 0,
	};

	private startTime: number = 0;
	private listeners: ((progress: ProgressUpdate) => void)[] = [];

	startTracking(totalStocks: number, totalBatches: number): void {
		this.startTime = Date.now();
		this.progress = {
			currentBatch: 0,
			totalBatches,
			completedStocks: 0,
			totalStocks,
			currentBatchStocks: [],
			successCount: 0,
			errorCount: 0,
			recentErrors: [],
			elapsedTime: 0,
		};
		this.notifyListeners();
	}

	updateBatch(batchNumber: number, batchStocks: string[]): void {
		this.progress.currentBatch = batchNumber;
		this.progress.currentBatchStocks = batchStocks;
		this.updateElapsedTime();
		this.notifyListeners();
	}

	updateCurrentSymbol(symbol: string): void {
		this.progress.currentSymbol = symbol;
		this.updateElapsedTime();
		this.notifyListeners();
	}

	addSuccess() {
		this.progress.successCount++;
		this.progress.completedStocks++;
		this.updateElapsedTime();
		this.notifyListeners();
	}

	addError(symbol: string, error: string): void {
		this.progress.errorCount++;
		this.progress.completedStocks++;
		this.progress.recentErrors.unshift(`${symbol}: ${error}`);

		// Keep only last 5 errors
		if (this.progress.recentErrors.length > 5) {
			this.progress.recentErrors = this.progress.recentErrors.slice(0, 5);
		}

		this.updateElapsedTime();
		this.notifyListeners();
	}

	private updateElapsedTime(): void {
		this.progress.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
	}

	getProgress(): ProgressUpdate {
		this.updateElapsedTime();
		return { ...this.progress };
	}

	addListener(listener: (progress: ProgressUpdate) => void): void {
		this.listeners.push(listener);
	}

	removeListener(listener: (progress: ProgressUpdate) => void): void {
		const index = this.listeners.indexOf(listener);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	}

	private notifyListeners(): void {
		this.listeners.forEach((listener) => {
			listener({ ...this.progress });
		});
	}

	reset(): void {
		this.listeners = [];
		this.progress = {
			currentBatch: 0,
			totalBatches: 0,
			completedStocks: 0,
			totalStocks: 0,
			currentBatchStocks: [],
			successCount: 0,
			errorCount: 0,
			recentErrors: [],
			elapsedTime: 0,
		};
	}
}

// Global singleton instance
export const progressTracker = new GlobalProgressTracker();
