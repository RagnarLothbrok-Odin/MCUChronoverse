export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { registerNode } = await import("./instrumentation.node");
        registerNode();
    }
}

export async function onRequestError(
    error: { digest: string } & Error,
    request: {
        method: string;
        path: string;
    }
): Promise<void> {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { logRequestError } = await import("./instrumentation.node");
        logRequestError(error, request);
    }
}

