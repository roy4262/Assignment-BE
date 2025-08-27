import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 5000,
  ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY || "",
  FMP_KEY: process.env.FMP_KEY || "",
  EXCEL_PATH: process.env.EXCEL_PATH || "./data/portfolio.xlsx",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  CACHE_TTL_PRICE_MS: Number(process.env.CACHE_TTL_PRICE_MS || 15000),
  CACHE_TTL_FUND_MS: Number(process.env.CACHE_TTL_FUND_MS || 3600000),
  // Support both FINNHUB_KEY and legacy FINHUB_API_KEY names
  FINNHUB_KEY: process.env.FINNHUB_KEY || process.env.FINHUB_API_KEY || "",
};
