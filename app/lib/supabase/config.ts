const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const missingSupabaseConfig = !(supabaseUrl && supabasePublishableKey);

if (missingSupabaseConfig && process.env.NODE_ENV !== "development") {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export const isSupabaseConfigured = !missingSupabaseConfig;

let config: { key: string; url: string } | undefined;

if (supabaseUrl && supabasePublishableKey) {
    const parsedSupabaseUrl = new URL(supabaseUrl);
    if (parsedSupabaseUrl.pathname !== "/") {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL must be the project root URL without an API path"
        );
    }
    config = {
        key: supabasePublishableKey,
        url: parsedSupabaseUrl.origin,
    };
}

export function requireSupabaseConfig() {
    if (!config) {
        throw new Error("Supabase is not configured for this development environment");
    }
    return config;
}

export const supabaseCookieOptions = {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
} as const;
