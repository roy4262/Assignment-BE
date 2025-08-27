export interface ExcelRow {
    Particulars: string;
    "Purchase Price": number;
    Qty: number;
    "NSE/BSE": string;
    Sector?: string;
}
export interface StockData {
    stock: string;
    symbol: string;
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
//# sourceMappingURL=types.d.ts.map