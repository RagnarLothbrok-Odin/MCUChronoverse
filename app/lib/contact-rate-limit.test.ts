import { describe, expect, test } from "bun:test";
import { checkContactRateLimit } from "./contact-rate-limit";

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
});
