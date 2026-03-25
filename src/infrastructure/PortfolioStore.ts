import * as fs from 'fs';
import * as path from 'path';
import { Position, Transaction } from '../domain/Position.js';

export interface PortfolioData {
  version: number;
  positions: Position[];
}

const DEFAULT_PORTFOLIO: PortfolioData = {
  version: 1,
  positions: []
};

export class PortfolioStore {
  private filePath: string;

  constructor(filename: string = 'portfolio.json') {
    this.filePath = path.join(process.cwd(), 'data', filename);
  }

  load(): Position[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const rawData = JSON.parse(content);

      if (!this.isValidPortfolioData(rawData)) {
        console.warn('⚠️ Invalid portfolio data, resetting to empty');
        return [];
      }

      // Handle backward compatibility - older portfolios without version default to 1
      const data = rawData as PortfolioData;
      if (typeof data.version !== 'number') {
        data.version = 1;
        // Save with version for future loads
        this.save(data.positions);
      }

      return data.positions || [];
    } catch (error) {
      console.warn('⚠️ Failed to load portfolio:', error);
      return [];
    }
  }

  save(positions: Position[]): void {
    try {
      const data: PortfolioData = { version: 1, positions };
      this.ensureDirectoryExists();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ Failed to save portfolio:', error);
    }
  }

  getPosition(symbol: string, positions: Position[]): Position | undefined {
    return positions.find(p => p.symbol === symbol);
  }

  addTransaction(symbol: string, name: string, transaction: Transaction, positions: Position[]): Position[] {
    const index = positions.findIndex(p => p.symbol === symbol);
    
    if (index >= 0) {
      const updated = [...positions];
      updated[index] = {
        ...updated[index],
        transactions: [...updated[index].transactions, transaction]
      };
      return updated;
    }
    
    return [...positions, { symbol, name, transactions: [transaction] }];
  }

  removeTransaction(symbol: string, transactionId: string, positions: Position[]): Position[] {
    const index = positions.findIndex(p => p.symbol === symbol);
    if (index < 0) return positions;

    const updated = [...positions];
    updated[index] = {
      ...updated[index],
      transactions: updated[index].transactions.filter(t => t.id !== transactionId)
    };

    if (updated[index].transactions.length === 0) {
      return updated;
    }

    return updated;
  }

  removePosition(symbol: string, positions: Position[]): Position[] {
    return positions.filter(p => p.symbol !== symbol);
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private isValidPortfolioData(data: unknown): data is PortfolioData {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.positions)) return false;
    
    for (const pos of d.positions as unknown[]) {
      if (typeof pos !== 'object' || pos === null) return false;
      const p = pos as Record<string, unknown>;
      if (typeof p.symbol !== 'string') return false;
      if (!Array.isArray(p.transactions)) return false;
    }
    // version is optional (defaults to 1 for backward compatibility)
    return true;
  }
}
