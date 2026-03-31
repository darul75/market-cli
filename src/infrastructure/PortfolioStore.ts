import fs from "node:fs";
import path from "node:path";
import type { Position, Transaction } from "../domain/Position.js";
import { YahooFinanceClient } from "./YahooFinanceClient.js";

import { log } from "../shared/Logger.js";

const debugLog = log("PortfolioStore");

export interface PortfolioData {
	version: number;
	positions: Position[];
}

export class PortfolioStore {
	private filePath: string;
	private apiClient: YahooFinanceClient;
	private currencyCache: Map<string, string> = new Map();

	constructor(filename: string = "portfolio.json") {
		this.filePath = path.join(process.cwd(), "data", filename);
		this.apiClient = new YahooFinanceClient();
	}

	private async fetchStockCurrency(symbol: string) {
		if (this.currencyCache.has(symbol)) {
			return this.currencyCache.get(symbol);
		}

		try {
			const data = await this.apiClient.fetchSingleStock(symbol);
			const currency = data?.currency || null;
			if (currency) {
				this.currencyCache.set(symbol, currency);
				debugLog(`💱 ${symbol}: currency = ${currency}`);
			} else {
				console.warn(`⚠️ No currency returned for ${symbol}`);
			}
			return currency;
		} catch (error) {
			console.warn(`⚠️ Failed to fetch currency for ${symbol}:`, error);
			return null;
		}
	}

	async load(): Promise<Position[]> {
		try {
			if (!fs.existsSync(this.filePath)) {
				return [];
			}

			const content = fs.readFileSync(this.filePath, "utf-8");
			const rawData = JSON.parse(content);

			if (!this.isValidPortfolioData(rawData)) {
				console.warn("⚠️ Invalid portfolio data, resetting to empty");
				return [];
			}

			const data = rawData as PortfolioData;
			if (typeof data.version !== "number") {
				data.version = 1;
			}

			if (data.version < 2) {
				debugLog("🔄 Migrating portfolio to version 2...");

				const uniqueSymbols = [...new Set(data.positions.map((p) => p.symbol))];
				debugLog(`📊 Fetching currencies for ${uniqueSymbols.length} stocks...`);

				for (let i = 0; i < data.positions.length; i++) {
					const position = data.positions[i];
					const currency = await this.fetchStockCurrency(position.symbol);

					data.positions[i] = {
						...position,
						transactions: position.transactions.map((t) => ({
							...t,
							currency: currency || t.currency || "USD",
						})),
					};

					if (i < data.positions.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 500));
					}
				}

				data.version = 2;
				this.save(data.positions);
				debugLog("✅ Migration complete");
			}

			return data.positions || [];
		} catch (error) {
			console.warn("⚠️ Failed to load portfolio:", error);
			return [];
		}
	}

	save(positions: Position[]): void {
		try {
			const data: PortfolioData = { version: 2, positions };
			this.ensureDirectoryExists();
			fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
		} catch (error) {
			console.error("❌ Failed to save portfolio:", error);
		}
	}

	getPosition(symbol: string, positions: Position[]): Position | undefined {
		return positions.find((p) => p.symbol === symbol);
	}

	addTransaction(symbol: string, name: string, transaction: Transaction, positions: Position[]): Position[] {
		const index = positions.findIndex((p) => p.symbol === symbol);

		if (index >= 0) {
			const updated = [...positions];
			updated[index] = {
				...updated[index],
				transactions: [...updated[index].transactions, transaction],
			};
			return updated;
		}

		return [...positions, { symbol, name, transactions: [transaction] }];
	}

	removeTransaction(symbol: string, transactionId: string, positions: Position[]): Position[] {
		const index = positions.findIndex((p) => p.symbol === symbol);
		if (index < 0) return positions;

		const updated = [...positions];
		updated[index] = {
			...updated[index],
			transactions: updated[index].transactions.filter((t) => t.id !== transactionId),
		};

		if (updated[index].transactions.length === 0) {
			return updated;
		}

		return updated;
	}

	removePosition(symbol: string, positions: Position[]): Position[] {
		return positions.filter((p) => p.symbol !== symbol);
	}

	private ensureDirectoryExists(): void {
		const dir = path.dirname(this.filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	private isValidPortfolioData(data: unknown): data is PortfolioData {
		if (typeof data !== "object" || data === null) return false;
		const d = data as Record<string, unknown>;
		if (!Array.isArray(d.positions)) return false;

		for (const pos of d.positions as unknown[]) {
			if (typeof pos !== "object" || pos === null) return false;
			const p = pos as Record<string, unknown>;
			if (typeof p.symbol !== "string") return false;
			if (!Array.isArray(p.transactions)) return false;
		}
		return true;
	}
}
