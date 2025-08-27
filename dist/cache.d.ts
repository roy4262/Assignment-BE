export declare class Cache {
    private store;
    set<T>(key: string, value: T, ttlMs: number): void;
    get<T>(key: string): T | null;
}
export declare const cache: Cache;
//# sourceMappingURL=cache.d.ts.map