import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig, supabaseCookieOptions } from "./config";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
    if (!browserClient) {
        browserClient = createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.key, {
            cookieOptions: supabaseCookieOptions,
        });
    }
    return browserClient;
}
