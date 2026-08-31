import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig, supabaseCookieOptions } from "./config";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
    if (!browserClient) {
        const supabaseConfig = requireSupabaseConfig();
        browserClient = createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.key, {
            cookieOptions: supabaseCookieOptions,
        });
    }
    return browserClient;
}
