import { type NextRequest, NextResponse } from "next/server";
import { resolveAuthRedirect } from "../../lib/supabase/auth-redirect";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    const destination = resolveAuthRedirect(
        request.nextUrl.origin,
        request.nextUrl.searchParams.get("next")
    );

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(destination);
        }
    }

    return NextResponse.redirect(new URL("/?auth=failed", request.nextUrl.origin));
}
