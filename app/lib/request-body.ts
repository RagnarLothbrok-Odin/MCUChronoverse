type LimitedJsonResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: "invalid" | "too-large" };

export async function readLimitedJsonBody(
    request: Request,
    maximumBytes: number
): Promise<LimitedJsonResult> {
    if (!(request.body && Number.isSafeInteger(maximumBytes) && maximumBytes > 0)) {
        return { ok: false, reason: "invalid" };
    }

    const reader = request.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let body = "";
    let receivedBytes = 0;
    let finished = false;

    try {
        while (!finished) {
            // Stream reads are intentionally sequential so the byte cap is applied before the next chunk.
            // biome-ignore lint/performance/noAwaitInLoops: A body stream must be consumed in order.
            const { done, value } = await reader.read();
            if (done) {
                finished = true;
                continue;
            }

            receivedBytes += value.byteLength;
            if (receivedBytes > maximumBytes) {
                await reader.cancel().catch(() => undefined);
                return { ok: false, reason: "too-large" };
            }
            body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
        return { ok: true, value: JSON.parse(body) };
    } catch {
        return { ok: false, reason: "invalid" };
    }
}
