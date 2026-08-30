import { createClient } from "./client";

export async function readRemoteWatchProgress() {
    const { data, error } = await createClient()
        .from("watch_progress")
        .select("entry_slug")
        .order("watched_at");
    if (error) {
        throw error;
    }
    return data.map(({ entry_slug }) => entry_slug);
}

export async function addRemoteWatchProgress(slugs: string[]) {
    if (slugs.length === 0) {
        return;
    }
    const { error } = await createClient()
        .from("watch_progress")
        .upsert(
            slugs.map((entry_slug) => ({ entry_slug })),
            { onConflict: "user_id,entry_slug" }
        );
    if (error) {
        throw error;
    }
}

export async function setRemoteWatchStatus(slug: string, watched: boolean) {
    const query = watched
        ? createClient()
              .from("watch_progress")
              .upsert({ entry_slug: slug }, { onConflict: "user_id,entry_slug" })
        : createClient().from("watch_progress").delete().eq("entry_slug", slug);
    const { error } = await query;
    if (error) {
        throw error;
    }
}

export async function clearRemoteWatchProgress() {
    const { error } = await createClient()
        .from("watch_progress")
        .delete()
        .not("entry_slug", "is", null);
    if (error) {
        throw error;
    }
}
