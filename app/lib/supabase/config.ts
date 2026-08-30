const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!(supabaseUrl && supabasePublishableKey)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

const parsedSupabaseUrl = new URL(supabaseUrl);
if (parsedSupabaseUrl.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the project root URL without an API path");
}

export const supabaseConfig = {
    key: supabasePublishableKey,
    url: parsedSupabaseUrl.origin,
};
