import express from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { readExcel } from "./excel.js";
import { enrichData } from "./compute.js";
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
app.listen(CONFIG.PORT, () => {
    console.log(`✅ Backend running on http://localhost:${CONFIG.PORT}`);
});
//# sourceMappingURL=index.js.map