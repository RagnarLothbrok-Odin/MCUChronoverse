import { describe, expect, test } from "bun:test";
import { checkContactRateLimit, checkDurableContactRateLimit } from "./contact-rate-limit";

describe("contact rate limit", () => {
    test("blocks requests until the rolling window expires", () => {
        const key = `test-${crypto.randomUUID()}`;
        const options = { limit: 2, now: 1000, windowMs: 1000 };

        expect(checkContactRateLimit(key, options).allowed).toBe(true);
        expect(checkContactRateLimit(key, options).allowed).toBe(true);
        expect(checkContactRateLimit(key, options)).toEqual({
            allowed: false,
            retryAfterSeconds: 1,
        });
        expect(checkContactRateLimit(key, { ...options, now: 2001 }).allowed).toBe(true);
    });

    test("maps the durable database response", async () => {
        const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const originalFetch = globalThis.fetch;

        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
        globalThis.fetch = Object.assign(
            (input: RequestInfo | URL, init?: RequestInit) => {
                expect(String(input)).toBe(
                    "https://example.supabase.co/rest/v1/rpc/check_contact_rate_limit"
                );
                expect(JSON.parse(String(init?.body))).toEqual({
                    p_limit: 3,
                    p_rate_key: "submission:test",
                    p_window_seconds: 3600,
                });
                return Promise.resolve(
                    Response.json([{ allowed: false, retry_after_seconds: 27 }])
                );
            },
            { preconnect: originalFetch.preconnect }
        );

        try {
            expect(
                await checkDurableContactRateLimit("submission:test", {
                    limit: 3,
                    windowMs: 3_600_000,
                })
            ).toEqual({ allowed: false, retryAfterSeconds: 27 });
        } finally {
            globalThis.fetch = originalFetch;
            if (originalUrl === undefined) {
                delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            } else {
                process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
            }
            if (originalServiceRoleKey === undefined) {
                delete process.env.SUPABASE_SERVICE_ROLE_KEY;
            } else {
                process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
            }
        }
    });
});
