import yahooFinance from "yahoo-finance2";
import fetch from "node-fetch";
import { CONFIG } from "../config.js";
import { cache } from "../cache.js";
import { resolveToYahooTicker } from "./prices.js";

export async function getFundamentals(rawSymbol: string) {
  const cacheKey = `fund:${rawSymbol}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) return cached;

  const tryAlphaVantage = async (symbol: string | null) => {
    if (!symbol || !CONFIG.ALPHAVANTAGE_KEY) return null;
    try {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(
        symbol
      )}&apikey=${CONFIG.ALPHAVANTAGE_KEY}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data && data.PERatio && data.PERatio !== "None") {
        return {
          peRatio: Number(data.PERatio),
          eps: data.EPS && data.EPS !== "None" ? Number(data.EPS) : "N/A",
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Resolve to a Yahoo ticker (prefer NSE), then try Yahoo first
  const yahooTicker = await resolveToYahooTicker(rawSymbol);
  if (yahooTicker) {
    try {
      const qs = (await yahooFinance.quoteSummary(yahooTicker, {
        modules: [
          "price",
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
        ] as any,
      })) as any;

      const priceRM: number | null =
        Number(qs?.price?.regularMarketPrice) || null;
      const trailingPE: number | null =
        Number(qs?.summaryDetail?.trailingPE) || null;
      const epsTTM: number | null =
        Number(qs?.defaultKeyStatistics?.trailingEps) || null;

      let peComputed: number | null = null;
      if (
        !Number.isFinite(trailingPE as number) &&
        Number(priceRM) > 0 &&
        Number(epsTTM) > 0
      ) {
        peComputed = Number(priceRM) / Number(epsTTM);
      }

      const result = {
        peRatio: Number.isFinite(trailingPE as number)
          ? (trailingPE as number)
          : Number.isFinite(peComputed as number)
          ? (peComputed as number)
          : "N/A",
        eps: Number.isFinite(epsTTM as number) ? (epsTTM as number) : "N/A",
      };

      if (result.peRatio !== "N/A" || result.eps !== "N/A") {
        cache.set(cacheKey, result, CONFIG.CACHE_TTL_FUND_MS);
        return result;
      }
    } catch {
      // ignore and fall back
    }
  }

  let fundamentals = await tryAlphaVantage(yahooTicker);
  if (!fundamentals) fundamentals = await tryAlphaVantage(rawSymbol);

  const finalResult = fundamentals || { peRatio: "N/A", eps: "N/A" };
  cache.set(cacheKey, finalResult, CONFIG.CACHE_TTL_FUND_MS);
  return finalResult;
}
