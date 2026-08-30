import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
    if (!browserClient) {
        browserClient = createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.key);
    }
    return browserClient;
}
