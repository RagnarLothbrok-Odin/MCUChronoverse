import { describe, expect, test } from "bun:test";
import { chronology } from "../data/chronology";
import { buildContactIssue, parseContactSubmission } from "./contact-submission";

const validInput = {
    category: "Year or date",
    context: "",
    correction: "The corrected placement should be 2012.",
    entrySlug: chronology[0]?.slug ?? "",
    problem: "The displayed year is currently incorrect.",
    source: "https://example.com/source",
    turnstileToken: "verified-token",
};

describe("contact submissions", () => {
    test("resolves timeline entries from trusted chronology data", () => {
        const parsed = parseContactSubmission(validInput);

        expect(parsed.error).toBeUndefined();
        expect(parsed.submission?.entryTitle).toBe(chronology[0]?.title);
    });

    test("requires a valid entry for entry-related categories", () => {
        const parsed = parseContactSubmission({ ...validInput, entrySlug: "not-a-real-entry" });

        expect(parsed.submission).toBeUndefined();
        expect(parsed.error).toContain("Select the timeline entry");
    });

    test("does not attach stale entries to general suggestions", () => {
        const parsed = parseContactSubmission({
            ...validInput,
            category: "Website improvement",
        });

        expect(parsed.submission?.entryTitle).toBe("Not applicable");
    });

    test("rejects unsupported source protocols", () => {
        const parsed = parseContactSubmission({ ...validInput, source: "javascript:alert(1)" });

        expect(parsed.submission).toBeUndefined();
        expect(parsed.error).toContain("HTTP or HTTPS");
    });

    test("neutralizes mentions and HTML in public issue text", () => {
        const parsed = parseContactSubmission({
            ...validInput,
            problem: "This pings @octocat and includes <details> markup.",
        });
        expect(parsed.submission).toBeDefined();
        if (!parsed.submission) {
            throw new Error("Expected a valid contact submission");
        }
        const issue = buildContactIssue(parsed.submission);

        expect(issue.body).toContain("@\u200Boctocat");
        expect(issue.body).toContain("&lt;details&gt;");
    });
});
