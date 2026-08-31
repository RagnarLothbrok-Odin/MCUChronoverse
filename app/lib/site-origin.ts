const localOrigin = "http://localhost:3000";

interface SiteOriginOptions {
    requireConfigured?: boolean;
}

export function siteOrigin(options: SiteOriginOptions = {}): string {
    const configuredOrigin = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!configuredOrigin) {
        if (options.requireConfigured) {
            throw new Error("SITE_URL is required for authentication in production");
        }
        return localOrigin;
    }

    try {
        const url = new URL(configuredOrigin);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error("Site origin must use HTTP or HTTPS");
        }
        return url.origin;
    } catch (error) {
        throw new Error("SITE_URL must be a valid absolute URL", { cause: error });
    }
}
