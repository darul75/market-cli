# CAC40 Live Monitor

A modern CLI application for monitoring live CAC40 stock prices in real-time, built with OpenTUI, RxJS, and TypeScript using Domain-Driven Design principles.

## Features

🚀 **Real-time Updates** - Stock prices update every 3 seconds  
📊 **Rich Terminal UI** - Beautiful interface powered by OpenTUI  
⚡ **Reactive Architecture** - Built with RxJS for smooth data streams  
🏗️ **Clean Architecture** - Lightweight Domain-Driven Design  
🔄 **Error Recovery** - Graceful fallback to sample data when API is unavailable  
💰 **Financial Data** - Live price changes, volume, and market sentiment  

## Technology Stack

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and package manager
- **[OpenTUI](https://opentui.com)** - Native terminal UI framework with Zig core
- **[RxJS](https://rxjs.dev)** - Reactive programming for data streams
- **[TypeScript](https://typescriptlang.org)** - Type safety and developer experience
- **Yahoo Finance API** - Alternative data source for CAC40 stocks

## Architecture

The application follows Domain-Driven Design principles with clear separation of concerns:

```
src/
├── domain/                 # Core business logic
│   ├── Stock.ts           # Stock entity with business methods
│   ├── Price.ts           # Price value object with currency handling
│   └── MarketData.ts      # Market data aggregate with analysis
├── infrastructure/        # External adapters
│   ├── YahooFinanceClient.ts      # API client for stock data
│   ├── DataTransformationService.ts # Domain object transformation
│   └── TerminalRenderer.ts        # OpenTUI interface components
├── application/           # Use cases and coordination
│   ├── StockDataStream.ts         # RxJS reactive data streams
│   └── StockMonitorApp.ts         # Main application service
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

# Test domain models
bun run test.ts
```

### Interface Overview

```
┌─────────────────────────── CAC40 Live Monitor ──────────────────────────────┐
│ 📈 CAC40 Live Monitor                                    🟢 LIVE            │
└──────────────────────────────────────────────────────────────────────────────┘

Stocks: 10    ↑ 6    ↓ 4                           Sentiment: BULLISH

┌──────────────────────────────────────────────────────────────────────────────┐
│ #  │ Symbol     │ Name               │ Price    │ Change │ %Change │ Volume  │
├────┼────────────┼────────────────────┼──────────┼────────┼─────────┼─────────┤
│ 1  │ LVMH.PA    │ LVMH              │ €692.50  │ +5.80  │ +0.84%  │ 2.1M    │
│ 2  │ ASML.AS    │ ASML Holding      │ €715.20  │ +12.45 │ +1.77%  │ 1.2M    │
│ 3  │ SAP.PA     │ SAP               │ €189.34  │ -2.11  │ -1.10%  │ 890K    │
└──────────────────────────────────────────────────────────────────────────────┘

Last: 14:30:05                                      Press Ctrl+C to exit
```

## Features in Detail

### Market Data

- **Real-time Prices** - Live updates from Yahoo Finance API
- **Price Changes** - Absolute and percentage changes with color coding
- **Volume Information** - Trading volume with human-readable formatting
- **Market Sentiment** - Overall market direction (Bullish/Bearish/Neutral)

### Error Handling

- **API Failures** - Graceful fallback to sample data
- **Network Issues** - Automatic retry logic with exponential backoff
- **Rate Limiting** - Respects API limits with appropriate intervals
- **Connection Status** - Visual indicators for live/offline status

### User Experience

- **Color-coded Data** - Green for gains, red for losses
- **Real-time Updates** - Smooth updates without flickering
- **Responsive Layout** - Adapts to terminal size
- **Keyboard Support** - Clean exit with Ctrl+C

## Data Sources

### Yahoo Finance API

The application uses Yahoo Finance's public API as the primary data source:

- **Endpoint:** `https://query1.finance.yahoo.com/v7/finance/quote`
- **CAC40 Symbols:** Major French stocks with `.PA` suffix (e.g., `LVMH.PA`, `SAP.PA`)
- **Update Frequency:** Every 3 seconds (configurable)
- **Rate Limits:** ~2000 requests/hour (handled gracefully)

### Sample Data

When the API is unavailable, the application falls back to realistic sample data including:

- LVMH, ASML, SAP, TotalEnergies, Sanofi
- Realistic price movements and volumes
- Proper market sentiment calculations

## Domain Model

### Core Entities

- **Stock** - Represents individual stocks with price calculations
- **Price** - Value object with currency and formatting logic
- **MarketData** - Aggregate containing multiple stocks with market analysis

### Business Logic

- Price change calculations (absolute and percentage)
- Volume formatting (K, M, B notation)
- Market sentiment analysis (Bullish/Bearish/Neutral)
- Risk indicators based on volatility
- Data freshness validation

## Development

### Architecture Decisions

1. **Lightweight DDD** - Clean domain modeling without over-engineering
2. **Reactive Streams** - RxJS for elegant async data handling
3. **Type Safety** - Full TypeScript coverage for reliability
4. **Error Recovery** - Resilient design with fallback mechanisms
5. **Performance** - Native OpenTUI rendering for smooth updates

### Testing

```bash
# Test domain models
bun run test.ts

# Manual testing with sample data
bun run dev  # Will show sample data if API fails
```

### Extending

The modular architecture makes it easy to:

- Add new stock exchanges or indices
- Integrate different data providers
- Implement additional UI components
- Add features like watchlists or alerts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [OpenTUI](https://opentui.com) - for the excellent terminal UI framework
- [Yahoo Finance](https://finance.yahoo.com) - for providing market data
- [RxJS](https://rxjs.dev) - for reactive programming primitives
- [Bun](https://bun.sh) - for the fast development experience
