import type { MetadataRoute } from "next";
import { siteOrigin } from "./lib/site-origin";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            allow: "/",
            disallow: ["/api/", "/auth/"],
            userAgent: "*",
        },
        sitemap: `${siteOrigin()}/sitemap.xml`,
    };
}
