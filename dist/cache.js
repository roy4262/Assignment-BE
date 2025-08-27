export class Cache {
    store = new Map();
    set(key, value, ttlMs) {
        this.store.set(key, { value, expiry: Date.now() + ttlMs });
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
}
export const cache = new Cache();
//# sourceMappingURL=cache.js.map