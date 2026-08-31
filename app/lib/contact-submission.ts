import { chronology } from "../data/chronology";

export const contactCategories = [
    "Timeline placement",
    "Year or date",
    "Title information",
    "Missing entry",
    "Website improvement",
    "Other",
] as const;

export const entryContactCategories = new Set<string>([
    "Timeline placement",
    "Year or date",
    "Title information",
]);

export interface ContactSubmission {
    category: (typeof contactCategories)[number];
    context: string;
    correction: string;
    entryTitle: string;
    problem: string;
    source: string;
    turnstileToken: string;
}

interface ParseResult {
    error?: string;
    submission?: ContactSubmission;
}

const chronologyBySlug = new Map(chronology.map((entry) => [entry.slug, entry]));

function readString(value: unknown): string | null {
    return typeof value === "string" ? value.trim() : null;
}

function isAllowedSource(value: string): boolean {
    if (!value) {
        return true;
    }

    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function escapeTableCell(value: string): string {
    return safeIssueText(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function safeIssueText(value: string): string {
    return value.replaceAll("@", "@\u200B").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function parseContactSubmission(value: unknown): ParseResult {
    if (!value || typeof value !== "object") {
        return { error: "The suggestion could not be read." };
    }

    const input = value as Record<string, unknown>;
    const category = readString(input.category);
    const context = readString(input.context);
    const correction = readString(input.correction);
    const entrySlug = readString(input.entrySlug);
    const problem = readString(input.problem);
    const source = readString(input.source);
    const turnstileToken = readString(input.turnstileToken);

    if (!(category && contactCategories.includes(category as ContactSubmission["category"]))) {
        return { error: "Choose what needs attention." };
    }
    if (!problem || problem.length < 10 || problem.length > 2000) {
        return { error: "Describe the current problem in between 10 and 2,000 characters." };
    }
    if (!correction || correction.length < 10 || correction.length > 2000) {
        return { error: "Describe the suggested change in between 10 and 2,000 characters." };
    }
    if (context === null || context.length > 1000) {
        return { error: "Additional context must be no longer than 1,000 characters." };
    }
    if (source === null || source.length > 500 || !isAllowedSource(source)) {
        return { error: "Supporting evidence must be a valid HTTP or HTTPS link." };
    }
    if (!turnstileToken || turnstileToken.length > 2048) {
        return { error: "Complete the verification before submitting." };
    }

    const entry =
        entryContactCategories.has(category) && entrySlug
            ? chronologyBySlug.get(entrySlug)
            : undefined;
    if (entryContactCategories.has(category) && !entry) {
        return { error: "Select the timeline entry this report is about." };
    }

    return {
        submission: {
            category: category as ContactSubmission["category"],
            context,
            correction,
            entryTitle: entry?.title ?? "Not applicable",
            problem,
            source,
            turnstileToken,
        },
    };
}

export function buildContactIssue(submission: ContactSubmission): {
    body: string;
    title: string;
} {
    const details = [
        "| Field | Value |",
        "| --- | --- |",
        `| **Entry** | ${escapeTableCell(submission.entryTitle)} |`,
        `| **Area** | ${escapeTableCell(submission.category)} |`,
    ].join("\n");
    const body = [
        "## Report details",
        details,
        `## Current archive entry\n\n${safeIssueText(submission.problem)}`,
        `## Suggested correction\n\n${safeIssueText(submission.correction)}`,
        `## Supporting source\n\n${safeIssueText(submission.source || "Not provided")}`,
        ...(submission.context
            ? [`## Additional context\n\n${safeIssueText(submission.context)}`]
            : []),
        "---\n_Submitted through [MCU Chronoverse](https://mcu.valhalladev.org)._",
    ].join("\n\n");

    return {
        body,
        title: `[Timeline correction] ${submission.entryTitle === "Not applicable" ? submission.category : submission.entryTitle}`,
    };
}
