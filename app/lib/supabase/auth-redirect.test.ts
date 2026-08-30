import { describe, expect, test } from "bun:test";
import { resolveAuthRedirect } from "./auth-redirect";

describe("auth callback redirects", () => {
    const origin = "https://chronoverse.example";

    test("keeps valid application paths", () => {
        expect(resolveAuthRedirect(origin, "/?type=film").href).toBe(
            "https://chronoverse.example/?type=film"
        );
    });

    test("rejects absolute external URLs", () => {
        expect(resolveAuthRedirect(origin, "https://example.com/phishing").href).toBe(
            "https://chronoverse.example/"
        );
    });

    test("rejects backslash-based external URLs", () => {
        expect(resolveAuthRedirect(origin, "/\\example.com/phishing").href).toBe(
            "https://chronoverse.example/"
        );
    });
});
