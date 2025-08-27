import axios from "axios";
import Fuse from "fuse.js";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config.js";
import { resolveToYahooTicker } from "../services/prices.js";

// Input and output JSON files (relative to project root or env configurable)
const INPUT_PATH =
  process.env.PORTFOLIO_JSON_IN ||
  path.resolve(process.cwd(), "portfolio.json");
const OUTPUT_PATH =
  process.env.PORTFOLIO_JSON_OUT ||
  path.resolve(process.cwd(), "portfolio_updated.json");

const YAHOO_URL = "https://query1.finance.yahoo.com/v7/finance/quote";

async function getExchangeSymbols(exchange: string) {
  if (!CONFIG.FINNHUB_KEY)
    throw new Error("FINNHUB_KEY missing in environment");
  const url = `https://finnhub.io/api/v1/stock/symbol?exchange=${encodeURIComponent(
    exchange
  )}&token=${CONFIG.FINNHUB_KEY}`;
  const res = await axios.get(url);
  return res.data as Array<{
    symbol: string; // e.g., ICICIBANK
    displaySymbol?: string;
    description: string; // e.g., ICICI Bank Limited
  }>;
}

async function searchYahooSymbolByName(name: string): Promise<string | null> {
  try {
    const res = await axios.get(
      "https://query1.finance.yahoo.com/v1/finance/search",
      {
        params: { q: name, lang: "en-IN", region: "IN", quotesCount: 10 },
      }
    );
    const quotes = (res.data?.quotes || []) as any[];
    const nse = quotes.find(
      (q) => typeof q?.symbol === "string" && q.symbol.endsWith(".NS")
    );
    if (nse?.symbol) return nse.symbol;
    const any = quotes.find((q) => typeof q?.symbol === "string");
    return any?.symbol ?? null;
  } catch {
    return null;
  }
}

async function resolveSymbols(portfolio: any[], symbols: any[]) {
  const fuse = new Fuse(symbols, {
    keys: ["description", "symbol", "displaySymbol"],
    threshold: 0.45,
    ignoreLocation: true,
    distance: 100,
    minMatchCharLength: 2,
  });

  for (const holding of portfolio) {
    const query = String(holding.stock || holding.symbol || "").trim();
    if (!query) continue;

    const result = fuse.search(query);
    if (result.length > 0) {
      const first = result[0];
      if (first && first.item) {
        const match = first.item as any;
        const rawSymbol = String(match?.symbol || "").trim();
        const disp = String(match?.displaySymbol || "").trim();
        const isNumeric = (s: string) => /^\d+$/.test(s);
        // Prefer non-numeric base; fall back to displaySymbol; else leave unresolved
        const baseCandidate =
          !isNumeric(rawSymbol) && rawSymbol
            ? rawSymbol
            : isNumeric(disp)
            ? ""
            : disp;
        if (baseCandidate) {
          const base = baseCandidate;
          const preferred = base.includes(".") ? base : `${base}.NS`;
          holding.symbol = preferred;
          holding.exchangeCode =
            base.split(".")[0] || holding.exchangeCode || null;
          continue;
        }
      }
    }

    // Fallback to Yahoo search if Finnhub match not found
    const ysym = await searchYahooSymbolByName(query);
    if (ysym) {
      holding.symbol = ysym;
      holding.exchangeCode = ysym.split(".")[0] || holding.exchangeCode || null;
      continue;
    }

    // Final fallback: use backend resolver (handles numeric codes well)
    const resolved = await resolveToYahooTicker(query);
    if (resolved) {
      holding.symbol = resolved;
      holding.exchangeCode =
        resolved.split(".")[0] || holding.exchangeCode || null;
      continue;
    }
  }
  return portfolio;
}

async function enrichWithYahoo(portfolio: any[]) {
  const symbols = portfolio.map((h) => h.symbol).filter(Boolean);
  if (!symbols.length) return portfolio;

  // Yahoo allows comma-separated list
  const url = `${YAHOO_URL}?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await axios.get(url);
  const results = ((res.data || {}).quoteResponse || {}).result || [];
  const map = Object.fromEntries(results.map((r: any) => [r.symbol, r]));

  for (const h of portfolio) {
    const d = map[h.symbol];
    if (!d) continue;
    const cmp = Number(d.regularMarketPrice ?? 0) || 0;
    h.cmp = cmp;
    h.presentValue = +(cmp * Number(h.qty || 0)).toFixed(2);
    h.gainLoss = +(h.presentValue - Number(h.investment || 0)).toFixed(2);
    h.peRatio = d.trailingPE ?? h.peRatio ?? "N/A";
    h.latestEarnings = d.epsTrailingTwelveMonths ?? h.latestEarnings ?? "N/A";
  }
  return portfolio;
}

async function main() {
  // Load portfolio JSON
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input portfolio file not found: ${INPUT_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
  const holdings: any[] = Array.isArray(raw?.holdings) ? raw.holdings : raw;

  console.log("📥 Fetching symbol lists...");
  const [nse, bse] = await Promise.all([
    getExchangeSymbols("NSE"),
    getExchangeSymbols("BSE"),
  ]);
  const allSymbols = [...nse, ...bse];

  console.log("🔎 Resolving symbols...");
  let updated = await resolveSymbols(holdings, allSymbols);

  console.log("💹 Fetching CMP & metrics from Yahoo...");
  updated = await enrichWithYahoo(updated);

  const output = Array.isArray(raw?.holdings)
    ? { ...raw, holdings: updated }
    : updated;

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Portfolio updated → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Error:", err?.message || err);
  process.exit(1);
});
