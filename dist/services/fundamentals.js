import yahooFinance from "yahoo-finance2";
import fetch from "node-fetch";
import { CONFIG } from "../config.js";
import { cache } from "../cache.js";
import { resolveToYahooTicker } from "./prices.js";
export async function getFundamentals(rawSymbol) {
    const cacheKey = `fund:${rawSymbol}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const tryAlphaVantage = async (symbol) => {
        if (!symbol || !CONFIG.ALPHAVANTAGE_KEY)
            return null;
        try {
            const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${CONFIG.ALPHAVANTAGE_KEY}`;
            const res = await fetch(url);
            const data = (await res.json());
            if (data && data.PERatio && data.PERatio !== "None") {
                return {
                    peRatio: Number(data.PERatio),
                    eps: data.EPS && data.EPS !== "None" ? Number(data.EPS) : "N/A",
                };
            }
            return null;
        }
        catch {
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
                ],
            }));
            const priceRM = Number(qs?.price?.regularMarketPrice) || null;
            const trailingPE = Number(qs?.summaryDetail?.trailingPE) || null;
            const epsTTM = Number(qs?.defaultKeyStatistics?.trailingEps) || null;
            let peComputed = null;
            if (!Number.isFinite(trailingPE) &&
                Number(priceRM) > 0 &&
                Number(epsTTM) > 0) {
                peComputed = Number(priceRM) / Number(epsTTM);
            }
            const result = {
                peRatio: Number.isFinite(trailingPE)
                    ? trailingPE
                    : Number.isFinite(peComputed)
                        ? peComputed
                        : "N/A",
                eps: Number.isFinite(epsTTM) ? epsTTM : "N/A",
            };
            if (result.peRatio !== "N/A" || result.eps !== "N/A") {
                cache.set(cacheKey, result, CONFIG.CACHE_TTL_FUND_MS);
                return result;
            }
        }
        catch {
            // ignore and fall back
        }
    }
    let fundamentals = await tryAlphaVantage(yahooTicker);
    if (!fundamentals)
        fundamentals = await tryAlphaVantage(rawSymbol);
    const finalResult = fundamentals || { peRatio: "N/A", eps: "N/A" };
    cache.set(cacheKey, finalResult, CONFIG.CACHE_TTL_FUND_MS);
    return finalResult;
}
//# sourceMappingURL=fundamentals.js.map