import { createClient } from "./client";

export async function readRemoteWatchProgress(userId: string) {
    const { data, error } = await createClient()
        .from("watch_progress")
        .select("entry_slug")
        .eq("user_id", userId)
        .order("watched_at");
    if (error) {
        throw error;
    }
    return data.map(({ entry_slug }) => entry_slug);
}

export async function setRemoteWatchStatus(userId: string, slug: string, watched: boolean) {
    const query = watched
        ? createClient()
              .from("watch_progress")
              .upsert({ entry_slug: slug, user_id: userId }, { onConflict: "user_id,entry_slug" })
        : createClient()
              .from("watch_progress")
              .delete()
              .eq("user_id", userId)
              .eq("entry_slug", slug);
    const { error } = await query;
    if (error) {
        throw error;
    }
}

export async function clearRemoteWatchProgress(userId: string) {
    const { error } = await createClient()
        .from("watch_progress")
        .delete()
        .eq("user_id", userId)
        .not("entry_slug", "is", null);
    if (error) {
        throw error;
    }
}
