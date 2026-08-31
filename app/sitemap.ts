import type { MetadataRoute } from "next";
import { siteOrigin } from "./lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = siteOrigin();
    return [
        {
            changeFrequency: "weekly",
            priority: 1,
            url: origin,
        },
        {
            changeFrequency: "monthly",
            priority: 0.5,
            url: `${origin}/about`,
        },
        {
            changeFrequency: "monthly",
            priority: 0.5,
            url: `${origin}/contact`,
        },
    ];
}
