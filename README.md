# Stock Live Monitor

A modern CLI application for monitoring live stock prices in real-time with portfolio tracking, built with OpenTUI, RxJS, and TypeScript using Domain-Driven Design principles.

## Features

:rocket: **Real-time Updates** - Stock prices update every 60 seconds  
:mag: **Stock Search** - Search and add any stock from Yahoo Finance  
:chart_with_upwards_trend: **Portfolio Tracking** - Track quantities, invested amounts, and total portfolio value  
:currency_exchange: **BUY/SELL Transactions** - Record buy and sell transactions with historical prices  
:chart: **Realized & Unrealized P&L** - Track profits/losses from trades and current positions  
:receipt: **Transaction History** - View all transactions for any stock with date picker  
:floppy_disk: **Persistent Portfolio** - Portfolio saved to JSON file, survives restarts  
:point_down_1: **Interactive Table** - Select rows, move stocks up/down, delete stocks  
:keyboard: **Keyboard Shortcuts** - Full keyboard control (b/s/d/o/x/h/arrows)  

## Technology Stack

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and package manager
- **[OpenTUI](https://opentui.com)** - Native terminal UI framework with Zig core
- **[RxJS](https://rxjs.dev)** - Reactive programming for data streams
- **[TypeScript](https://typescriptlang.org)** - Type safety and developer experience
- **Yahoo Finance API** - Real-time stock data via v8 chart endpoint

## Installation

### Homebrew (macOS)

The easiest way to install on macOS:

```bash
brew install darul75/market-cli/market-cli
```

To update to the latest version:
```bash
brew upgrade darul75/market-cli/market-cli
```

### From Source

If you prefer to build from source, you'll need [Bun](https://bun.sh) installed.
- Modern terminal (WezTerm, Alacritty, iTerm2, etc. recommended)

### Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Build the application:**
   ```bash
   bun run build
   ```

3. **Run the application:**
   ```bash
   bun run src/main.ts
   # or for production
   bun run dist/main.js
   ```

4. **Exit the application:**
   Press `Ctrl+C` to exit gracefully

## Usage

### Development Commands

```bash
# Install dependencies
bun install

# Build for production
bun run build

# Run from source
bun run src/main.ts

# Run production build
bun run start

# Type checking
bun run type-check
```

### Interface Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📈 Stock Live Monitor                                            🟢 LIVE      │
└──────────────────────────────────────────────────────────────────────────────┘

Stocks: 1    ↑ 1    ↓ 0                               Sentiment: BULLISH

┌──────────────────────────────────────────────────────────────────────────────┐
│ #  Symbol   Price     Change  Qty  Invested    Value      Unreal.   Real.   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1  AAPL     251.49    +3.50   10   €2,000     €2,515     +€515     -      │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐  ┌────────────────────────┐
│ 🔍 Search Stocks            │  │ 💼 Portfolio           │
│ > AAPL_                     │  │     €2,515            │
│ ┌─────────────────────────┐ │  │   +€515 (+25.7%)      │
│ │ AAPL  Apple Inc.        │ │  └────────────────────────┘
│ └─────────────────────────┘ │
└─────────────────────────────┘

Last: 9:58:05 AM                                      Press Ctrl+C to exit
```

### How to Use

1. **View stocks** - The main table shows all tracked stocks with live prices
2. **Select a stock** - Click on any row or use ↑/↓ arrows to select (shows action buttons)
3. **Add stocks** - Type in the search panel to find and add new stocks (saved to portfolio)
4. **Buy stocks** - Press `b` or click 📈 button to record a BUY transaction
5. **Sell stocks** - Press `s` or click 📉 button to record a SELL transaction
6. **View history** - Press `o` or click 📋 button to see all transactions for a stock
7. **Move stocks** - Use 🔼/🔽 buttons to reorder stocks (order persisted)
8. **Delete stocks** - Press `d` or click ❌ button to remove stock from portfolio
9. **Delete transactions** - Press `x` to delete selected transaction (in history panel)
10. **View help** - Press `h` to see all keyboard shortcuts

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate stock selection |
| `b` | Open buy dialog (stock selected) |
| `s` | Open sell dialog (stock selected) |
| `d` | Delete stock confirmation (stock selected) |
| `o` | Toggle transaction history (stock selected) |
| `x` | Delete selected transaction |
| `Enter` | Confirm dialog |
| `Esc` | Close dialog / Cancel |
| `h` | Show help dialog |

### Stock Table Columns

| Column | Description |
|--------|-------------|
| `#` | Row number |
| `Symbol` | Stock ticker symbol |
| `Price` | Current market price |
| `Change` | Price change today |
| `Qty` | Current share quantity held |
| `Invested` | Total amount invested (from BUY transactions) |
| `Value` | Current market value (Qty × Price) |
| `Unreal.` | Unrealized P&L (current value - invested) |
| `Real.` | Realized P&L (from completed SELL transactions) |
| `Actions` | Action buttons (buy, sell, history, move, delete) |

### Action Buttons

| Button | Action | Description |
|--------|--------|-------------|
| 📈 | Buy | Record a BUY transaction |
| 📉 | Sell | Record a SELL transaction |
| 📋 | History | View transaction history |
| 🔼 | Move Up | Move stock up in the list |
| 🔽 | Move Down | Move stock down in the list |
| ❌ | Delete | Remove stock from portfolio |

## Features in Detail

### Portfolio Persistence

- Portfolio is saved to `data/portfolio.json`
- Automatically loaded on startup
- Changes are saved immediately (add stock, buy, sell, delete)
- Stocks remain in portfolio even with 0 transactions (can add new transactions later)
- Supports empty portfolio - app shows main UI with "No stocks" message

### BUY/SELL Transactions

- **BUY transactions** - Record purchases with date, quantity, and price
- **SELL transactions** - Record sales with FIFO cost basis calculation
- **Date picker** - Select transaction date from calendar
- **Historical prices** - Fetch price from Yahoo Finance for transaction date
- **FIFO accounting** - First-In-First-Out for realized P&L calculation

### Transaction History Panel

Press 📋 on any stock to view all transactions:
```
┌─ Transaction History: AAPL ────────────────────────────────────────┐
│                                                                     │
│  BUY  2026-03-01   10 shares @ €200.00  = €2,000.00              │
│  SELL 2026-03-15    5 shares @ €220.00  = €1,100.00              │
│                                                                     │
│  Remaining: 5 shares | Avg Cost: €200.00                          │
│  Realized P&L: +€100.00                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### P&L Calculations

- **Unrealized P&L** - Shows gain/loss on current holdings
  - Formula: (Current Price × Qty) - Total Invested
  - Updates in real-time with price changes

- **Realized P&L** - Shows profit/loss from completed trades
  - Uses FIFO (First-In-First-Out) method
  - Calculated when shares are sold
  - Includes partial sells (selling some but not all shares)

### Stock Search

- **Real-time search** - Search any stock symbol via Yahoo Finance
- **Debounced queries** - 1 second debounce to avoid excessive API calls
- **Result display** - Shows symbol, name, and exchange for each match
- **Quick add** - Click on a result to add it to your portfolio

### Interactive Table

- **Row selection** - Click to select, click again to deselect
- **Keyboard navigation** - Use ↑/↓ arrows to navigate stocks
- **Zebra striping** - Visual distinction between rows
- **Action buttons** - Visible when row is selected
- **Scrollable** - Handle large lists with viewport culling
- **Order persistence** - Stock order saved and restored on restart

### Data Loading

- **Smart batching** - Fetches 8 stocks per batch for reliability
- **Progress tracking** - Shows batch progress, success/error counts
- **Rate limiting** - 0.8s delay between requests, 2s between batches
- **Error handling** - Continues with successful stocks even if some fail

### User Experience

- **Color-coded data** - Green for gains, red for losses
- **Mouse support** - Full mouse interaction for clicks and selection
- **Responsive layout** - Flexbox layout adapts to terminal size
- **Clean exit** - Graceful shutdown with Ctrl+C
- **Portfolio summary** - Total portfolio value and P&L shown beside search

## Data Sources

### Yahoo Finance API

The application uses Yahoo Finance's v8 chart endpoint as the primary data source:

- **Stock Data Endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- **Search Endpoint:** `https://query2.finance.yahoo.com/v1/finance/search`
- **Historical Data:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={timestamp}&period2={timestamp}`
- **Update Frequency:** Every 60 seconds
- **Initial Load:** Smart batching with progress tracking

## Portfolio Data Structure

The portfolio is stored in `data/portfolio.json`:

```json
{
  "positions": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "transactions": [
        {
          "id": "abc123",
          "type": "BUY",
          "date": "2026-03-01",
          "qty": 10,
          "pricePerShare": 200.00
        },
        {
          "id": "def456",
          "type": "SELL",
          "date": "2026-03-15",
          "qty": 5,
          "pricePerShare": 220.00
        }
      ]
    }
  ]
}
```

## Development

### Running the App

```bash
# Type checking
bun run type-check

# Manual testing
bun run src/main.ts
```

### Extending

```bash
# Type checking
bun run type-check

# Manual testing
bun run src/main.ts
```

### Extending

The modular architecture makes it easy to:

- Add new stock exchanges or indices
- Integrate different data providers
- Implement additional UI components
- Add features like alerts, price targets, or historical charts
- Export portfolio reports (CSV, PDF)

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [OpenTUI](https://opentui.com) - for the excellent terminal UI framework
- [Yahoo Finance](https://finance.yahoo.com) - for providing market data
- [RxJS](https://rxjs.dev) - for reactive programming primitives
- [Bun](https://bun.sh) - for the fast development experience
