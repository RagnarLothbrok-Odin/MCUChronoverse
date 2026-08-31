import { NextResponse } from "next/server";
import { log } from "../../lib/console";
import { siteOrigin } from "../../lib/site-origin";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

function failedAuthRedirect(origin: string) {
    return NextResponse.redirect(new URL("/?auth=failed", origin));
}

export async function GET() {
    const origin = siteOrigin({ requireConfigured: process.env.NODE_ENV === "production" });

    if (!isSupabaseConfigured) {
        return failedAuthRedirect(origin);
    }

    try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.signInWithOAuth({
            options: { redirectTo: `${origin}/auth/callback` },
            provider: "discord",
        });

        if (error || !data.url) {
            log.error(
                "Discord OAuth could not be started",
                error?.message ?? "No provider URL returned"
            );
            return failedAuthRedirect(origin);
        }

        const response = NextResponse.redirect(data.url);
        response.headers.set("Cache-Control", "no-store");
        return response;
    } catch (error) {
        log.error("Discord OAuth setup failed", error);
        return failedAuthRedirect(origin);
    }
}
