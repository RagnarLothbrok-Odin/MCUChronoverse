import { createHash, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { log } from "../../lib/console";
import { checkContactRateLimit } from "../../lib/contact-rate-limit";
import { buildContactIssue, parseContactSubmission } from "../../lib/contact-submission";
import { siteOrigin } from "../../lib/site-origin";

export const runtime = "nodejs";

const githubRepositoryPattern = /^[A-Za-z\d](?:[A-Za-z\d.-]{0,38})?\/[A-Za-z\d_.-]+$/;
const developmentTurnstileSecret = "1x0000000000000000000000000000000AA";
const requestWindowMs = 10 * 60 * 1000;
const requestLimit = 10;
const submissionWindowMs = 60 * 60 * 1000;
const submissionLimit = 3;

interface TurnstileResult {
    action?: string;
    hostname?: string;
    success: boolean;
}

interface GitHubIssueResult {
    html_url?: string;
    number?: number;
}

function response(body: object, status: number, headers?: HeadersInit) {
    return NextResponse.json(body, {
        headers: { "Cache-Control": "no-store", ...headers },
        status,
    });
}

function clientAddress(request: NextRequest): string {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

function rateLimitKey(request: NextRequest): string {
    return createHash("sha256").update(clientAddress(request)).digest("hex");
}

function hasTrustedOrigin(request: NextRequest): boolean {
    if (process.env.NODE_ENV !== "production") {
        return true;
    }

    const origin = request.headers.get("origin");
    if (!origin) {
        return false;
    }

    try {
        return new URL(origin).origin === siteOrigin({ requireConfigured: true });
    } catch {
        return false;
    }
}

async function verifyTurnstile(token: string, request: NextRequest): Promise<boolean> {
    const secret =
        process.env.NODE_ENV === "production"
            ? process.env.TURNSTILE_SECRET_KEY
            : developmentTurnstileSecret;
    if (!secret) {
        throw new Error("TURNSTILE_SECRET_KEY is required in production");
    }

    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        body: JSON.stringify({
            idempotency_key: randomUUID(),
            remoteip: clientAddress(request),
            response: token,
            secret,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(8000),
    });
    if (!verification.ok) {
        throw new Error(`Turnstile returned HTTP ${verification.status}`);
    }

    const result = (await verification.json()) as TurnstileResult;
    if (!result.success) {
        return false;
    }

    if (process.env.NODE_ENV === "production") {
        if (result.action !== "contact_submission") {
            return false;
        }
        const expectedHostname = new URL(siteOrigin({ requireConfigured: true })).hostname;
        return result.hostname === expectedHostname;
    }

    return true;
}

async function createGitHubIssue(title: string, body: string): Promise<GitHubIssueResult> {
    const token = process.env.GITHUB_ISSUES_TOKEN;
    if (!token) {
        throw new Error("GITHUB_ISSUES_TOKEN is required");
    }
    const repository = process.env.GITHUB_ISSUES_REPOSITORY;
    if (!(repository && githubRepositoryPattern.test(repository))) {
        throw new Error("GITHUB_ISSUES_REPOSITORY must be a valid owner/repository value");
    }

    const githubResponse = await fetch(`https://api.github.com/repos/${repository}/issues`, {
        body: JSON.stringify({ body, labels: ["timeline", "correction"], title }),
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "MCU-Chronoverse",
            "X-GitHub-Api-Version": "2026-03-10",
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
    });

    if (!githubResponse.ok) {
        throw new Error(`GitHub returned HTTP ${githubResponse.status}`);
    }

    return (await githubResponse.json()) as GitHubIssueResult;
}

export async function POST(request: NextRequest) {
    if (!hasTrustedOrigin(request)) {
        return response({ error: "This submission origin is not allowed." }, 403);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return response({ error: "The suggestion must be sent as JSON." }, 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
        return response({ error: "That suggestion is too large to submit." }, 413);
    }

    const addressKey = rateLimitKey(request);
    if (process.env.NODE_ENV === "production") {
        const rateLimit = checkContactRateLimit(`request:${addressKey}`, {
            limit: requestLimit,
            windowMs: requestWindowMs,
        });
        if (!rateLimit.allowed) {
            return response(
                {
                    error: "Too many suggestions were sent from this connection. Try again shortly.",
                },
                429,
                { "Retry-After": String(rateLimit.retryAfterSeconds) }
            );
        }
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return response({ error: "The suggestion could not be read." }, 400);
    }

    const parsed = parseContactSubmission(payload);
    if (!parsed.submission) {
        return response({ error: parsed.error ?? "Check the suggestion and try again." }, 400);
    }

    try {
        const verified = await verifyTurnstile(parsed.submission.turnstileToken, request);
        if (!verified) {
            return response({ error: "Verification expired or failed. Please try again." }, 400);
        }

        if (process.env.NODE_ENV === "production") {
            const submissionRateLimit = checkContactRateLimit(`submission:${addressKey}`, {
                limit: submissionLimit,
                windowMs: submissionWindowMs,
            });
            if (!submissionRateLimit.allowed) {
                return response(
                    {
                        error: "This connection has reached the hourly suggestion limit. Try again later.",
                    },
                    429,
                    { "Retry-After": String(submissionRateLimit.retryAfterSeconds) }
                );
            }
        }

        const issue = buildContactIssue(parsed.submission);
        const createdIssue = await createGitHubIssue(issue.title, issue.body);
        if (!(createdIssue.html_url && createdIssue.number)) {
            throw new Error("GitHub returned an incomplete issue response");
        }

        log.ok(`Timeline suggestion #${createdIssue.number} was created`);
        return response({ issueNumber: createdIssue.number, issueUrl: createdIssue.html_url }, 201);
    } catch (error) {
        log.error("Timeline suggestion could not be created", error);
        return response(
            { error: "The suggestion could not be submitted right now. Please try again later." },
            502
        );
    }
}
