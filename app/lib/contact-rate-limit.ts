interface RateLimitBucket {
    hits: number[];
    windowMs: number;
}

interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

interface DurableRateLimitOptions {
    limit: number;
    windowMs: number;
}

interface DurableRateLimitRow {
    allowed: boolean;
    retry_after_seconds: number;
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

export async function checkDurableContactRateLimit(
    key: string,
    options: DurableRateLimitOptions
): Promise<RateLimitResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!(supabaseUrl && serviceRoleKey)) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for contact rate limiting"
        );
    }

    const response = await fetch(
        `${new URL(supabaseUrl).origin}/rest/v1/rpc/check_contact_rate_limit`,
        {
            body: JSON.stringify({
                p_limit: options.limit,
                p_rate_key: key,
                p_window_seconds: Math.ceil(options.windowMs / 1000),
            }),
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
                "Content-Type": "application/json",
            },
            method: "POST",
            signal: AbortSignal.timeout(5000),
        }
    );
    if (!response.ok) {
        throw new Error(`Contact rate limiter returned HTTP ${response.status}`);
    }

    const [result] = (await response.json()) as DurableRateLimitRow[];
    if (
        !result ||
        typeof result.allowed !== "boolean" ||
        !Number.isInteger(result.retry_after_seconds)
    ) {
        throw new Error("Contact rate limiter returned an invalid response");
    }
    return {
        allowed: result.allowed,
        retryAfterSeconds: result.retry_after_seconds,
    };
}
