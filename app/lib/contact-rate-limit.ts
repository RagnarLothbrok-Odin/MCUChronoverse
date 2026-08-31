interface RateLimitBucket {
    hits: number[];
    windowMs: number;
}

interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitBucket>();
let checksSinceCleanup = 0;

function cleanExpiredBuckets(now: number): void {
    checksSinceCleanup += 1;
    if (checksSinceCleanup < 100) {
        return;
    }

    checksSinceCleanup = 0;
    for (const [key, bucket] of buckets) {
        const oldestAllowed = now - bucket.windowMs;
        if (!bucket.hits.some((hit) => hit > oldestAllowed)) {
            buckets.delete(key);
        }
    }
}

export function checkContactRateLimit(
    key: string,
    options: { limit: number; now?: number; windowMs: number }
): RateLimitResult {
    const now = options.now ?? Date.now();
    const oldestAllowed = now - options.windowMs;
    const bucket = buckets.get(key) ?? { hits: [], windowMs: options.windowMs };
    bucket.windowMs = options.windowMs;
    bucket.hits = bucket.hits.filter((hit) => hit > oldestAllowed);

    if (bucket.hits.length >= options.limit) {
        const oldestHit = bucket.hits[0] ?? now;
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((oldestHit + options.windowMs - now) / 1000)),
        };
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    cleanExpiredBuckets(now);
    return { allowed: true, retryAfterSeconds: 0 };
}
