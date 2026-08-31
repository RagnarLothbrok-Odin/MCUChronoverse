import { type NextRequest, NextResponse } from "next/server";
import { log } from "../../lib/console";
import { siteOrigin } from "../../lib/site-origin";
import { resolveAuthRedirect } from "../../lib/supabase/auth-redirect";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    const origin = siteOrigin({ requireConfigured: process.env.NODE_ENV === "production" });
    const destination = resolveAuthRedirect(origin, request.nextUrl.searchParams.get("next"));

    if (!isSupabaseConfigured) {
        return NextResponse.redirect(new URL("/?auth=failed", origin));
    }

    if (code) {
        try {
            const supabase = await createClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (!error) {
                return NextResponse.redirect(destination);
            }

            log.warn("OAuth callback exchange was rejected", error.message);
        } catch (error) {
            log.error("OAuth callback exchange failed", error);
        }
    }

    return NextResponse.redirect(new URL("/?auth=failed", origin));
}
