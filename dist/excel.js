import xlsx from "xlsx";
const { readFile, utils } = xlsx;
import { CONFIG } from "./config.js";
// Normalize header names to our canonical keys
function normalizeHeader(h) {
    const s = String(h)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    if (["particulars", "name", "company", "stock"].includes(s))
        return "particulars";
    if (["purchaseprice", "buyprice", "price", "avgprice", "averageprice"].includes(s))
        return "purchasePrice";
    if (["qty", "quantity", "shares"].includes(s))
        return "qty";
    if (["nse", "bse", "nsebse", "exchange", "symbol", "ticker"].includes(s))
        return "nseBse";
    if (["sector", "industry"].includes(s))
        return "sector";
    return s; // keep as-is for any extra columns
}
export function readExcel() {
    const workbook = readFile(CONFIG.EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet)
        return [];
    // Read as a 2D array to handle header detection and sector header rows
    const rows = utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
    });
    if (!rows.length)
        return [];
    // Find header row by checking for required columns
    const headerRowIndex = rows.findIndex((r) => {
        const normalized = r.map((c) => normalizeHeader(String(c)));
        const hasParticulars = normalized.includes("particulars");
        const hasQty = normalized.includes("qty");
        const hasPrice = normalized.includes("purchasePrice");
        const hasSymbol = normalized.includes("nseBse");
        return hasParticulars && hasQty && hasPrice && hasSymbol;
    });
    if (headerRowIndex === -1) {
        // Fallback: assume first row is header
        console.warn("Excel header not clearly found; using first row as header");
    }
    const header = (rows[headerRowIndex === -1 ? 0 : headerRowIndex] || []).map((h) => normalizeHeader(String(h)));
    const result = [];
    let currentSector = "";
    for (let i = headerRowIndex === -1 ? 1 : headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((c) => String(c).trim() === ""))
            continue;
        // Sector header rows like "Financial Sector" or "Tech Sector"
        const firstCell = String(row[0] ?? "").trim();
        const isSectorHeader = /^.+\s+Sector$/i.test(firstCell);
        if (isSectorHeader) {
            currentSector = firstCell.replace(/\s+Sector$/i, "").trim();
            continue;
        }
        const obj = {};
        for (let c = 0; c < header.length; c++) {
            const key = header[c];
            if (!key)
                continue;
            obj[key] = row[c];
        }
        // Build canonical ExcelRow only if essential fields are present
        const particulars = String(obj.particulars || "").trim();
        const purchasePrice = Number(obj.purchasePrice ?? obj.price ?? 0);
        const qty = Number(obj.qty ?? 0);
        const nseBse = String(obj.nseBse || obj.symbol || "").trim();
        if (!particulars || !nseBse || !qty || !purchasePrice) {
            // skip non-data rows
            continue;
        }
        result.push({
            Particulars: particulars,
            "Purchase Price": purchasePrice,
            Qty: qty,
            "NSE/BSE": nseBse,
            Sector: obj.sector ? String(obj.sector) : currentSector,
        });
    }
    return result;
}
//# sourceMappingURL=excel.js.map