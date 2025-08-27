import yahooFinance from "yahoo-finance2";
yahooFinance.suppressNotices(["yahooSurvey"]);
import fetch from "node-fetch";
import { CONFIG } from "../config.js";
import { cache } from "../cache.js";

const RESOLVE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Resolve any raw input (ticker or BSE code) to a Yahoo-compatible ticker.
// Preference: NSE (.NS) first, then BSE (.BO).
export async function resolveToYahooTicker(
  raw: string,
  hintName?: string
): Promise<string | null> {
  const code = String(raw).trim();
  if (!code) return null;

  const cacheKey = `resolve:${code}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const tryYahoo = async (ticker: string) => {
    try {
      const q = await yahooFinance.quote(ticker);
      const price = Number(q?.regularMarketPrice || 0);
      return price > 0;
    } catch {
      return false;
    }
  };

  // Manual overrides (by company name hints). Applies early and verifies via Yahoo.
  try {
    const nName = (hintName || "").toUpperCase();
    const manual: Array<[string, string]> = [
      ["HAPPIEST", "HAPPSTMNDS.NS"],
      ["HARIOM", "HARIOMPIPE.NS"],
    ];
    for (const [needle, sym] of manual) {
      if (nName.includes(needle)) {
        if (await tryYahoo(sym)) {
          cache.set(cacheKey, sym, RESOLVE_TTL_MS);
          return sym;
        }
      }
    }
  } catch {
    // ignore manual override failures
  }

  // 1) Quick direct attempts
  const isNumeric = /^\d+$/.test(code);
  if (isNumeric) {
    const t = `${code}.BO`;
    if (await tryYahoo(t)) {
      cache.set(cacheKey, t, RESOLVE_TTL_MS);
      return t;
    }
  } else {
    const directAttempts = [code, `${code}.NS`, `${code}.BO`];
    for (const t of directAttempts) {
      if (await tryYahoo(t)) {
        cache.set(cacheKey, t, RESOLVE_TTL_MS);
        return t;
      }
    }
  }

  // 2) Yahoo search-based resolution (handles numeric BSE codes reliably)
  try {
    const term = hintName?.trim() || code;
    const search = await (yahooFinance as any).search(term, {
      quotesCount: 10,
      newsCount: 0,
    });
    const quotes: any[] = Array.isArray(search?.quotes) ? search.quotes : [];
    // prefer equities only
    const equities = quotes.filter((q) => (q.quoteType || q.type) === "EQUITY");

    const preferNse = (q: any) => {
      const exch = String(
        q.exchange || q.exch || q.exchDisp || ""
      ).toUpperCase();
      return exch.includes("NSE") || exch === "NSI";
    };
    const preferBse = (q: any) => {
      const exch = String(
        q.exchange || q.exch || q.exchDisp || ""
      ).toUpperCase();
      return exch.includes("BSE") || exch === "BOM";
    };

    // 2a) NSE symbol if available
    const nseQuote =
      equities.find(preferNse) || equities.find((q) => /\.NS$/i.test(q.symbol));
    if (nseQuote?.symbol && (await tryYahoo(nseQuote.symbol))) {
      cache.set(cacheKey, nseQuote.symbol, RESOLVE_TTL_MS);
      return nseQuote.symbol;
    }
    // 2b) else BSE symbol
    const bseQuote =
      equities.find(preferBse) || equities.find((q) => /\.BO$/i.test(q.symbol));
    if (bseQuote?.symbol && (await tryYahoo(bseQuote.symbol))) {
      cache.set(cacheKey, bseQuote.symbol, RESOLVE_TTL_MS);
      return bseQuote.symbol;
    }
  } catch {
    // ignore search errors
  }

  // 2b-alt) REST search fallback if SDK search didn't produce a match
  try {
    const term = hintName?.trim() || code;
    const restUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      term
    )}&lang=en-IN&region=IN&quotesCount=10&newsCount=0`;
    const r = await fetch(restUrl);
    const j = (await r.json()) as any;
    const quotes: any[] = Array.isArray(j?.quotes) ? j.quotes : [];
    const pick = (suffix: ".NS" | ".BO") =>
      quotes.find(
        (q) => typeof q?.symbol === "string" && q.symbol.endsWith(suffix)
      )?.symbol as string | undefined;
    const candNS =
      pick(".NS") ||
      (quotes.find((q) => /\.NS$/i.test(q?.symbol))?.symbol as
        | string
        | undefined);
    if (candNS && (await tryYahoo(candNS))) {
      cache.set(cacheKey, candNS, RESOLVE_TTL_MS);
      return candNS;
    }
    const candBO =
      pick(".BO") ||
      (quotes.find((q) => /\.BO$/i.test(q?.symbol))?.symbol as
        | string
        | undefined);
    if (candBO && (await tryYahoo(candBO))) {
      cache.set(cacheKey, candBO, RESOLVE_TTL_MS);
      return candBO;
    }
  } catch {
    // ignore
  }

  // 3) Heuristic for numeric codes using hint name (derive base and try .NS/.BO)
  if (/^\d+$/.test(code) && hintName) {
    const base = String(hintName)
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase();
    if (base.length >= 3) {
      const attempts = [`${base}.NS`, `${base}.BO`];
      for (const t of attempts) {
        if (await tryYahoo(t)) {
          cache.set(cacheKey, t, RESOLVE_TTL_MS);
          return t;
        }
      }
    }
  }

  // 4) Last resort: AlphaVantage search then verify on Yahoo
  if (CONFIG.ALPHAVANTAGE_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(
        hintName?.trim() || code
      )}&apikey=${CONFIG.ALPHAVANTAGE_KEY}`;
      const res = await fetch(url);
      const json = (await res.json()) as any;
      const best = Array.isArray(json?.bestMatches)
        ? json.bestMatches[0]
        : null;
      const bestSymbol = best?.["1. symbol"] as string | undefined;
      if (bestSymbol) {
        const guessNS = /\.[A-Z]+$/i.test(bestSymbol)
          ? bestSymbol
          : `${bestSymbol}.NS`;
        if (await tryYahoo(guessNS)) {
          cache.set(cacheKey, guessNS, RESOLVE_TTL_MS);
          return guessNS;
        }
        const guessBO = `${bestSymbol}.BO`;
        if (await tryYahoo(guessBO)) {
          cache.set(cacheKey, guessBO, RESOLVE_TTL_MS);
          return guessBO;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function getCMP(rawSymbol: string): Promise<number> {
  const looksYahoo = /\.[A-Za-z]{2,4}$/i.test(rawSymbol);
  const yahooTicker = looksYahoo
    ? rawSymbol
    : await resolveToYahooTicker(rawSymbol);
  const keyBase = yahooTicker || rawSymbol;
  const cacheKey = `price:${keyBase}`;

  const cached = cache.get<number>(cacheKey);
  if (cached) return cached;

  if (!yahooTicker) return 0;

  try {
    const data = await yahooFinance.quote(yahooTicker);
    const price = Number(data?.regularMarketPrice || 0);
    if (Number.isFinite(price) && price > 0 && price < 1_000_000) {
      cache.set(cacheKey, price, CONFIG.CACHE_TTL_PRICE_MS);
      return price;
    }
  } catch {
    // ignore
  }

  return 0;
}

// Direct price fetch for an already Yahoo-compatible ticker (e.g., ICICIBANK.NS)
export async function getCurrentMarketPrice(ticker: string): Promise<number> {
  const q = await yahooFinance.quote(ticker);
  const price = Number(q?.regularMarketPrice ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`No price for ${ticker}`);
  }
  return price;
}
