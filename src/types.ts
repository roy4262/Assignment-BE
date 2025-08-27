export interface ExcelRow {
  Particulars: string;
  "Purchase Price": number;
  Qty: number;
  "NSE/BSE": string; // may be mixed: ticker or BSE code
  Sector?: string;
}

export interface StockData {
  stock: string;
  // Yahoo-friendly ticker, prefer NSE (e.g., HDFCBANK.NS). If NSE unavailable, may be .BO.
  symbol: string;
  // Raw BSE code if provided (e.g., 532174). Null if not applicable.
  exchangeCode: string | null;
  sector?: string;
  purchasePrice: number;
  qty: number;
  investment: number;
  cmp: number;
  presentValue: number;
  gainLoss: number;
  portfolioPercent: number;
  peRatio: number | string;
  latestEarnings: number | string;
}
