const localOrigin = "http://localhost:3000";

export function siteOrigin(): string {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!configuredOrigin) {
        return localOrigin;
    }

    try {
        const url = new URL(configuredOrigin);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error("Site origin must use HTTP or HTTPS");
        }
        return url.origin;
    } catch (error) {
        throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL", { cause: error });
    }
}
