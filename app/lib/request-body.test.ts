import { describe, expect, test } from "bun:test";
import { readLimitedJsonBody } from "./request-body";

function streamedRequest(chunks: string[]): Request {
    const encoder = new TextEncoder();
    const init: RequestInit & { duplex: "half" } = {
        body: new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        }),
        duplex: "half",
        method: "POST",
    };
    return new Request("https://example.com/api/contact", init);
}

describe("limited JSON request bodies", () => {
    test("parses JSON split across streamed chunks", async () => {
        const result = await readLimitedJsonBody(streamedRequest(['{"message":', '"hello"}']), 32);
        expect(result).toEqual({ ok: true, value: { message: "hello" } });
    });

    test("rejects an oversized stream without a content length", async () => {
        const request = streamedRequest(['{"message":"', "x".repeat(32), '"}']);
        expect(request.headers.get("content-length")).toBeNull();
        expect(await readLimitedJsonBody(request, 16)).toEqual({
            ok: false,
            reason: "too-large",
        });
    });

    test("measures UTF-8 bytes instead of JavaScript characters", async () => {
        const result = await readLimitedJsonBody(streamedRequest(['{"value":"💫"}']), 15);
        expect(result).toEqual({ ok: false, reason: "too-large" });
    });

    test("rejects malformed JSON", async () => {
        const result = await readLimitedJsonBody(streamedRequest(["{"]), 16);
        expect(result).toEqual({ ok: false, reason: "invalid" });
    });
});
