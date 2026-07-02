# GoldWise 🏆

**Open-source gold jewellery price intelligence platform** — the free Karatwise alternative.

👉 **[github.com/shirishyc/goldwise](https://github.com/shirishyc/goldwise)**

Find gold jewellery priced closest to the raw gold rate. Compare making charges (premium %) across 40+ jewellers, track live gold rates, and get technical market analysis — all free, no subscription.

## Features

- **Live Gold Rates** — XAU/USD, MCX, GoodReturns, IBJA, USD/INR — auto-updating ticker
- **Product Finder** — Browse 40+ brands across 23 categories, filter by karat, sort by premium %
- **Jeweller Comparison** — Side-by-side premium % by category and karat
- **Gold Market Pulse** — Technical analysis: RSI, MACD, SMA, Bollinger Bands, Fibonacci, Pivot Points
- **Cost Calculator** — All-in price with making charges + GST
- **40+ Tracked Brands** — Tanishq, CaratLane, Bluestone, Bhima Gold, Ajio, Flipkart, Myntra, Malabar, Kalyan, etc.
- **PWA Ready** — Installable on mobile and desktop
- **100% Free & Open Source** — MIT License

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | Tailwind CSS 3 |

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Seed sample data
cd ../server && node src/scrapers/seed-data.js

# Start the server
node src/index.js
# Server runs on http://localhost:4567

# In another terminal, build the frontend
cd ../client && npm run build
# Then reload http://localhost:4567
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/live-rates` | Live gold rates (XAU/USD, MCX, INR, USD/INR) |
| `GET /api/products` | Product listing with filters (`brand`, `category`, `karat`, `sort`, `page`, `limit`) |
| `GET /api/products/summary` | Dashboard summary: stats, best deals, category breakdown |
| `GET /api/brands` | All tracked brands |
| `GET /api/categories` | All product categories |
| `GET /api/compare` | Jeweller comparison data |
| `GET /api/compare/categories` | Comparison matrix across all jewellers |
| `GET /api/pulse` | Market pulse with technical indicators |
| `GET /api/pulse/ai-summary` | Market summary text |
| `POST /api/pulse/force-regenerate` | Force regenerate market analysis |
| `GET /api/news` | Gold market news feed |
| `GET /api/health` | Health check |

## Data Sources

- **Gold Rates**: Calculated from XAU/USD + USD/INR with verified India premium (~10%), enhanced with GoodReturns scraping
- **Products**: Sample seed data included (200 products). Production should use web scrapers.
- **Exchange Rate**: ExchangeRate-API

## License

MIT — free to use, modify, and distribute.
