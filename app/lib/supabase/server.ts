import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import type { Database } from "./types";

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(supabaseConfig.url, supabaseConfig.key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    for (const { name, value, options } of cookiesToSet) {
                        cookieStore.set(name, value, options);
                    }
                } catch {
                    // Server Components cannot write cookies. The proxy refreshes sessions.
                }
            },
        },
    });
}
