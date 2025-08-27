import { getCMP, resolveToYahooTicker } from "./services/prices.js";
import { getFundamentals } from "./services/fundamentals.js";
// Process items in batches to improve speed while avoiding API rate limits
async function processInBatches(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize).map(fn);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
    }
    return results;
}
export async function enrichData(rows) {
    const totalInvestment = rows.reduce((sum, r) => sum + r["Purchase Price"] * r.Qty, 0);
    const batchSize = 5; // reasonable parallelism
    const result = await processInBatches(rows, batchSize, async (r) => {
        const raw = String(r["NSE/BSE"]).trim();
        const bseCode = /^\d+$/.test(raw) ? raw : null; // keep numeric as reference
        // Resolve once to Yahoo-friendly ticker; prefer NSE if possible
        const yahooTicker = (await resolveToYahooTicker(raw, r.Particulars)) || raw;
        // Fetch CMP and fundamentals concurrently for each row using the resolved ticker
        const [cmpRaw, fundamentals] = await Promise.all([
            getCMP(yahooTicker),
            getFundamentals(yahooTicker),
        ]);
        const cmp = Number.isFinite(cmpRaw) && cmpRaw > 0 ? cmpRaw : 0; // guard against bad values
        const investment = r["Purchase Price"] * r.Qty;
        const presentValue = cmp * r.Qty;
        const gainLoss = presentValue - investment;
        return {
            stock: r.Particulars,
            symbol: yahooTicker, // normalized ticker for API calls
            exchangeCode: bseCode, // raw BSE code as reference only
            sector: r.Sector || "",
            purchasePrice: r["Purchase Price"],
            qty: r.Qty,
            investment,
            cmp,
            presentValue,
            gainLoss,
            portfolioPercent: (investment / totalInvestment) * 100,
            peRatio: fundamentals.peRatio,
            latestEarnings: fundamentals.eps,
        };
    });
    return result;
}
//# sourceMappingURL=compute.js.map