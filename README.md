# Stock Live Monitor

A modern CLI application for monitoring live stock prices in real-time, built with OpenTUI, RxJS, and TypeScript using Domain-Driven Design principles.

## Features

:rocket: **Real-time Updates** - Stock prices update every 60 seconds  
:mag: **Stock Search** - Search and add any stock from Yahoo Finance  
:chart_with_upwards_trend: **Portfolio Tracking** - Track quantities and total portfolio value  
:point_down_1: **Interactive Table** - Select rows, move stocks up/down, delete stocks  
:zap: **Smart Batching** - Efficient API calls with progress tracking  
:art: **Rich Terminal UI** - Beautiful interface powered by OpenTUI  
:electric_plug: **Reactive Architecture** - Built with RxJS for smooth data streams  
:building_construction: **Clean Architecture** - Lightweight Domain-Driven Design  

## Technology Stack

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and package manager
- **[OpenTUI](https://opentui.com)** - Native terminal UI framework with Zig core
- **[RxJS](https://rxjs.dev)** - Reactive programming for data streams
- **[TypeScript](https://typescriptlang.org)** - Type safety and developer experience
- **Yahoo Finance API** - Real-time stock data via v8 chart endpoint

## Architecture

```
src/
├── domain/                 # Core business logic
│   ├── Stock.ts           # Stock entity with business methods
│   ├── Price.ts           # Price value object with currency handling
│   ├── MarketData.ts      # Market data aggregate with analysis
│   └── SearchResult.ts    # Search result entity
├── infrastructure/        # External adapters
│   ├── YahooFinanceClient.ts      # API client for stock data (v8 endpoint)
│   ├── SymbolSearchClient.ts      # Search API client for finding stocks
│   ├── DataTransformationService.ts # Domain object transformation
│   ├── TerminalRenderer.ts        # OpenTUI interface components
│   └── search/                   # Search panel components
│       ├── SearchPanel.ts
│       ├── SearchInput.ts
│       └── SearchResultsTable.ts
├── application/           # Use cases and coordination
│   ├── StockDataStream.ts         # RxJS reactive data streams
│   ├── StockMonitorApp.ts        # Main application service
│   └── SearchService.ts          # Stock search service
├── shared/                # Shared utilities
│   └── ProgressTracker.ts        # Loading progress tracking
└── main.ts               # Application entry point
```

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Modern terminal (WezTerm, Alacritty, etc. recommended)

### Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Run the application:**
   ```bash
   bun run dev
   ```

3. **Exit the application:**
   Press `Ctrl+C` to exit gracefully

## Usage

### Development Commands

```bash
# Start the application in development mode
bun run dev

# Build for production
bun run build

# Run production build
bun run start

# Type checking
bun run type-check

# Run tests
bun run test
```

### Interface Overview

```
┌─────────────────────────── Stock Live Monitor ───────────────────────────────┐
│ 📈 Stock Live Monitor                                    🟢 LIVE             │
└───────────────────────────────────────────────────────────────────────────────┘

Stocks: 5    ↑ 3    ↓ 2                           Sentiment: BULLISH

┌──────────────────────────────────────────────────────────────────────────────┐
│ #  │ Symbol      │ Name               │ Price    │ Change │ %Change │ Volume  │
├────┼─────────────┼────────────────────┼──────────┼────────┼─────────┼─────────┤
│ 1  │ AI.PA       │ Air Liquide        │ €165.40  │ +2.30  │ +1.41%  │ 1.2M    │
│ 2  │ ALO.PA      │ Alstom             │ €24.15   │ -0.45  │ -1.83%  │ 890K    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ 🔍 Search Stocks ───────────────────────────────────────────────────────────┐
│ > LVMH____________                                                      [X] │
│   LVMH.PA  | LVMH Moet Hennessy Louis Vuitton | Paris (3 matches)            │
│   LVMH     | LVMH                           | Currency in USD              │
└──────────────────────────────────────────────────────────────────────────────┘

Last: 14:30:05                                      Press Ctrl+C to exit
```

### How to Use

1. **View stocks** - The main table shows all tracked stocks with live prices
2. **Select a stock** - Click on any row to select it (shows action buttons)
3. **Move stocks** - Use :arrow_up:/:arrow_down: buttons to reorder stocks
4. **Delete stocks** - Use the :x: button to remove a stock from the list
5. **Track quantities** - Select a row and click the pencil icon to set share quantity
6. **Add stocks** - Type in the search panel to find and add new stocks
7. **Portfolio value** - Total portfolio value appears when quantities are set

## Features in Detail

### Stock Search

- **Real-time search** - Search any stock symbol via Yahoo Finance
- **Debounced queries** - 300ms debounce to avoid excessive API calls
- **Result display** - Shows symbol, name, and exchange for each match
- **Quick add** - Click on a result to add it to your watchlist

### Portfolio Tracking

- **Quantity management** - Set share quantities for each stock
- **Real-time valuation** - Total portfolio value calculated from current prices
- **Persistent display** - Portfolio summary shows at the bottom when quantities are set
- **Edit dialog** - Modal dialog for entering/editing quantities

### Interactive Table

- **Row selection** - Click to select, click again to deselect
- **Zebra striping** - Visual distinction between rows
- **Action buttons** - Move up, move down, delete (visible when row selected)
- **Scrollable** - Handle large lists with viewport culling

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

## Data Sources

### Yahoo Finance API

The application uses Yahoo Finance's v8 chart endpoint as the primary data source:

- **Stock Data Endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- **Search Endpoint:** `https://query2.finance.yahoo.com/v1/finance/search`
- **CAC40 Symbols:** French stocks with `.PA` suffix (e.g., `LVMH.PA`, `AI.PA`)
- **Update Frequency:** Every 60 seconds
- **Initial Load:** Smart batching with progress tracking

### Default Tracked Stocks

The application starts with these CAC40 stocks:

- Air Liquide (AI.PA)
- Alstom (ALO.PA)
- ArcelorMittal (MT.AS)
- BNP Paribas (BNP.PA)

## Domain Model

### Core Entities

- **Stock** - Represents individual stocks with price calculations and formatting
- **Price** - Value object with currency and formatting logic
- **MarketData** - Aggregate containing multiple stocks with market analysis
- **SearchResult** - Search result entity with symbol, name, and exchange info

### Business Logic

- Price change calculations (absolute and percentage)
- Volume formatting (K, M, B notation)
- Market sentiment analysis (Bullish/Bearish/Neutral)
- Data freshness validation

## Development

### Architecture Decisions

1. **Lightweight DDD** - Clean domain modeling without over-engineering
2. **Reactive Streams** - RxJS for elegant async data handling
3. **Type Safety** - Full TypeScript coverage for reliability
4. **Progress Tracking** - Real-time feedback during batch loading
5. **Performance** - Native OpenTUI rendering with viewport culling

### Testing

```bash
# Run tests
bun run test

# Type checking
bun run type-check

# Manual testing
bun run dev
```

### Extending

The modular architecture makes it easy to:

- Add new stock exchanges or indices
- Integrate different data providers
- Implement additional UI components
- Add features like alerts or historical charts

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [OpenTUI](https://opentui.com) - for the excellent terminal UI framework
- [Yahoo Finance](https://finance.yahoo.com) - for providing market data
- [RxJS](https://rxjs.dev) - for reactive programming primitives
- [Bun](https://bun.sh) - for the fast development experience
