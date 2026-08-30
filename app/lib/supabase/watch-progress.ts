import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

export async function syncWatchProgress(user: User, localSlugs: string[]) {
    const supabase = createClient();
    const { data } = await supabase
        .from("watch_progress")
        .select("entry_slug")
        .eq("user_id", user.id);
    const remoteSlugs = (data ?? [])
        .map((row) => row.entry_slug)
        .filter((slug): slug is string => typeof slug === "string");
    const mergedSlugs = [...new Set([...remoteSlugs, ...localSlugs])];
    if (mergedSlugs.length > 0) {
        await supabase.from("watch_progress").upsert(
            mergedSlugs.map((entry_slug) => ({ entry_slug, user_id: user.id })),
            { onConflict: "user_id,entry_slug" }
        );
    }
    return mergedSlugs;
}

export function persistWatchChange(user: User | null, slug: string, watched: boolean) {
    if (!user) {
        return;
    }
    const supabase = createClient();
    if (watched) {
        supabase
            .from("watch_progress")
            .upsert({ entry_slug: slug, user_id: user.id }, { onConflict: "user_id,entry_slug" });
    } else {
        supabase.from("watch_progress").delete().eq("user_id", user.id).eq("entry_slug", slug);
    }
}
