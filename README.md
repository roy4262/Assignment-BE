# 🔧 Backend (Express + TypeScript)

REST API that reads holdings from Excel, enriches with market data, and serves JSON to the frontend.

## 🚀 Features

- Parse Excel holdings (xlsx)
- Resolve NSE/BSE to Yahoo tickers
- Fetch CMP and fundamentals (Yahoo Finance; AlphaVantage fallback)
- Caching and batching to respect rate limits

## 📦 Tech

- Node.js, Express, TypeScript
- Libraries: `xlsx`, `yahoo-finance2`, `axios`/`node-fetch`, `dotenv`, `cors`

## ⚙️ Env (.env)

```
PORT=5000
EXCEL_PATH=./data/Sample_Portfolio_BE_1EC0654C9A.xlsx
CORS_ORIGIN=*
# Optional keys
ALPHAVANTAGE_KEY=
FMP_KEY=
FINNHUB_KEY=
```

## 🏃 Run locally

```bash
npm install
npm run build
npm start
# or quick dev
npm run dev
```

- Server: http://localhost:5000
- Live API: https://assignment-be-whj6.onrender.com/api/portfolio

## 🔗 API Endpoints

- GET `/api/health` → `{ ok, time }`
- GET `/api/portfolio` → `{ holdings: HoldingRow[] }`
- GET `/api/holdings` → alias

### HoldingRow (response shape)

```ts
interface HoldingRow {
  stock: string;
  symbol: string; // Yahoo-compatible ticker (e.g., ICICIBANK.NS)
  exchangeCode: string; // BSE code if available
  sector: string;
  purchasePrice: number;
  qty: number;
  investment: number;
  cmp: number;
  presentValue: number;
  gainLoss: number;
  portfolioPercent: number;
  peRatio: number | "N/A";
  latestEarnings: number | "N/A";
}
```

## 📄 Excel input (columns)

- `Particulars`, `NSE/BSE`, `Purchase Price`, `Qty`, `Sector`

## 🧠 Notes

- Caching TTLs are configurable in `src/config.ts`
- Batching size configured in `src/compute.ts`
- AlphaVantage is optional and used only as a fallback for fundamentals
