import { PortfolioValuePoint } from './PortfolioHistoryService.js';

const BRAILLE_BASE = 0x2800;

function getBrailleChar(dots: number[]): string {
  const dotValue = dots.reduce((acc, d, i) => acc + (d ? (1 << i) : 0), 0);
  return String.fromCodePoint(BRAILLE_BASE + dotValue);
}

export class AsciiChart {
  static render(
    dataPoints: PortfolioValuePoint[],
    width: number = 40,
    height: number = 12
  ): string[] {
    if (dataPoints.length < 2) {
      return ['Not enough data to display chart'];
    }

    const values = dataPoints.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    const cols = width * 2;
    const rows = height * 4;
    const grid: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0));

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x1 = Math.floor((i / (dataPoints.length - 1)) * (cols - 1));
      const x2 = Math.floor(((i + 1) / (dataPoints.length - 1)) * (cols - 1));
      const y1 = range > 0 ? Math.floor(((values[i] - minValue) / range) * (rows - 1)) : Math.floor(rows / 2);
      const y2 = range > 0 ? Math.floor(((values[i + 1] - minValue) / range) * (rows - 1)) : Math.floor(rows / 2);

      const dx = x2 - x1;
      const dy = y2 - y1;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

      for (let s = 0; s <= steps; s++) {
        const t = steps > 0 ? s / steps : 0;
        const x = Math.round(x1 + t * dx);
        const y = Math.round(y1 + t * dy);

        if (x >= 0 && x < cols && y >= 0 && y < rows) {
          grid[y][x] = 1;
        }
      }
    }

    const lines: string[] = [];
    for (let row = 0; row < rows; row += 4) {
      let line = '';
      for (let col = 0; col < cols; col += 2) {
        const dots = [
          grid[row][col] || grid[row + 1]?.[col] || 0,
          grid[row][col + 1] || grid[row + 1]?.[col + 1] || 0,
          grid[row + 2]?.[col] || grid[row + 3]?.[col] || 0,
          grid[row + 2]?.[col + 1] || grid[row + 3]?.[col + 1] || 0,
          grid[row + 1]?.[col] || 0,
          grid[row + 1]?.[col + 1] || 0,
          grid[row + 3]?.[col] || 0,
          grid[row + 3]?.[col + 1] || 0,
        ];
        line += getBrailleChar(dots);
      }
      lines.push(line);
    }

    return lines;
  }

  static renderWithGradient(
    dataPoints: PortfolioValuePoint[],
    width: number = 40,
    height: number = 12
  ): { lines: string[]; colors: string[][] } {
    if (dataPoints.length < 2) {
      return { lines: ['Not enough data'], colors: [['#888888']] };
    }

    const values = dataPoints.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    const isPositive = values[values.length - 1] >= values[0];
    const positiveColor = '#00FF00';
    const negativeColor = '#FF4444';

    const cols = width * 2;
    const rows = height * 4;
    const grid: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0));
    const colors: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x1 = Math.floor((i / (dataPoints.length - 1)) * (cols - 1));
      const x2 = Math.floor(((i + 1) / (dataPoints.length - 1)) * (cols - 1));
      const y1 = range > 0 ? Math.floor(((values[i] - minValue) / range) * (rows - 1)) : Math.floor(rows / 2);
      const y2 = range > 0 ? Math.floor(((values[i + 1] - minValue) / range) * (rows - 1)) : Math.floor(rows / 2);
      const trend = values[i + 1] >= values[i] ? positiveColor : negativeColor;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

      for (let s = 0; s <= steps; s++) {
        const t = steps > 0 ? s / steps : 0;
        const x = Math.round(x1 + t * dx);
        const y = Math.round(y1 + t * dy);

        if (x >= 0 && x < cols && y >= 0 && y < rows) {
          grid[y][x] = 1;
          colors[y][x] = trend;
        }
      }
    }

    const lines: string[] = [];
    const lineColors: string[][] = [];

    for (let row = 0; row < rows; row += 4) {
      let line = '';
      const rowColors: string[] = [];

      for (let col = 0; col < cols; col += 2) {
        const dots = [
          grid[row][col] || grid[row + 1]?.[col] ? 1 : 0,
          grid[row][col + 1] || grid[row + 1]?.[col + 1] ? 1 : 0,
          grid[row + 2]?.[col] || grid[row + 3]?.[col] ? 1 : 0,
          grid[row + 2]?.[col + 1] || grid[row + 3]?.[col + 1] ? 1 : 0,
          grid[row + 1]?.[col] ? 1 : 0,
          grid[row + 1]?.[col + 1] ? 1 : 0,
          grid[row + 3]?.[col] ? 1 : 0,
          grid[row + 3]?.[col + 1] ? 1 : 0,
        ];

        const cellColor = colors[row]?.[col] || colors[row]?.[col + 1] || 
                          colors[row + 1]?.[col] || colors[row + 1]?.[col + 1] ||
                          colors[row + 2]?.[col] || colors[row + 2]?.[col + 1] ||
                          colors[row + 3]?.[col] || colors[row + 3]?.[col + 1];

        line += getBrailleChar(dots);
        rowColors.push(cellColor || '#00FF00');
      }
      lines.push(line);
      lineColors.push(rowColors);
    }

    return { lines, colors: lineColors };
  }

  static formatValue(value: number, currency: string = '€'): string {
    if (value >= 1000000) {
      return `${currency}${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${currency}${(value / 1000).toFixed(1)}K`;
    }
    return `${currency}${value.toFixed(0)}`;
  }
}
