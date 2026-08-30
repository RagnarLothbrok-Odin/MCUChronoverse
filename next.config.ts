import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    agentRules: false,
    images: {
        remotePatterns: [
            {
                hostname: "m.media-amazon.com",
                protocol: "https",
            },
        ],
    },
};

export default nextConfig;
