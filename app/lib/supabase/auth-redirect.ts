export function resolveAuthRedirect(origin: string, requestedPath: string | null) {
    if (!requestedPath) {
        return new URL("/", origin);
    }

    try {
        const destination = new URL(requestedPath, origin);
        return destination.origin === origin ? destination : new URL("/", origin);
    } catch {
        return new URL("/", origin);
    }
}
