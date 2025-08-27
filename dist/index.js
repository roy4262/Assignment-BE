import express from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { readExcel } from "./excel.js";
import { enrichData } from "./compute.js";
import { resolveToYahooTicker, getCMP } from "./services/prices.js";
import { getFundamentals } from "./services/fundamentals.js";
const app = express();
app.use(cors({ origin: CONFIG.CORS_ORIGIN }));
app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});
app.get("/api/portfolio", async (req, res) => {
    try {
        const rows = readExcel();
        const data = await enrichData(rows);
        // Wrap as { holdings: [...] } to match frontend expectations
        res.json({ holdings: data });
    }
    catch (err) {
        console.error("Error in /api/portfolio", err);
        res.status(500).json({ error: err.message });
    }
});
// Alias endpoint to match frontend expectation
app.get("/api/holdings", async (req, res) => {
    try {
        const rows = readExcel();
        const data = await enrichData(rows);
        res.json({ holdings: data });
    }
    catch (err) {
        console.error("Error in /api/holdings", err);
        res.status(500).json({ error: err.message });
    }
});
// Diagnostics: test resolution, price, and fundamentals for a given symbol or name
// Example: GET /api/debug/diagnose?symbol=HDFCBANK&name=HDFC%20Bank
app.get("/api/debug/diagnose", async (req, res) => {
    try {
        const symbol = String(req.query.symbol || "").trim();
        const name = String(req.query.name || "").trim();
        if (!symbol && !name) {
            return res.status(400).json({ error: "Provide symbol or name" });
        }
        const resolved = await resolveToYahooTicker(symbol || name, name || symbol);
        let price = null;
        let priceError = null;
        try {
            if (resolved)
                price = await getCMP(resolved);
            else
                price = await getCMP(symbol || name);
        }
        catch (e) {
            priceError = e?.message || String(e);
        }
        let fundamentals = null;
        let fundamentalsError = null;
        try {
            fundamentals = await getFundamentals(resolved || symbol || name);
        }
        catch (e) {
            fundamentalsError = e?.message || String(e);
        }
        return res.json({
            input: { symbol, name },
            resolvedTicker: resolved,
            yahooQuote: { price, error: priceError },
            fundamentals: { data: fundamentals, error: fundamentalsError },
            env: {
                hasAlphaVantageKey: Boolean(process.env.ALPHAVANTAGE_KEY),
                hasFinnhubKey: Boolean(process.env.FINNHUB_KEY || process.env.FINHUB_API_KEY),
            },
        });
    }
    catch (err) {
        console.error("Error in /api/debug/diagnose", err);
        res.status(500).json({ error: err.message });
    }
});
app.listen(CONFIG.PORT, () => {
    console.log(`✅ Backend running on http://localhost:${CONFIG.PORT}`);
});
//# sourceMappingURL=index.js.map