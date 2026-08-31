import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
    isSupabaseConfigured,
    requireSupabaseConfig,
    supabaseCookieOptions,
} from "./app/lib/supabase/config";
import type { Database } from "./app/lib/supabase/types";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    if (!isSupabaseConfigured) {
        return response;
    }
    const supabaseConfig = requireSupabaseConfig();
    const supabase = createServerClient<Database>(supabaseConfig.url, supabaseConfig.key, {
        cookieOptions: supabaseCookieOptions,
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                for (const { name, value } of cookiesToSet) {
                    request.cookies.set(name, value);
                }
                response = NextResponse.next({ request });
                for (const { name, value, options } of cookiesToSet) {
                    response.cookies.set(name, value, options);
                }
            },
        },
    });

    await supabase.auth.getClaims();
    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
