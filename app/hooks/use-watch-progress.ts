"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
    addRemoteWatchProgress,
    clearRemoteWatchProgress,
    readRemoteWatchProgress,
    setRemoteWatchStatus,
} from "../lib/supabase/watch-progress";
import {
    LEGACY_WATCHED_STORAGE_KEY,
    mergeWatchProgress,
    parseWatchProgressSnapshot,
    WATCH_PROGRESS_STORAGE_KEY,
    type WatchProgressSnapshot,
} from "../lib/watch-progress-storage";

function readLocalSnapshot() {
    try {
        return parseWatchProgressSnapshot(
            window.localStorage.getItem(WATCH_PROGRESS_STORAGE_KEY),
            window.localStorage.getItem(LEGACY_WATCHED_STORAGE_KEY)
        );
    } catch {
        return parseWatchProgressSnapshot(null);
    }
}

function writeLocalSnapshot(snapshot: WatchProgressSnapshot) {
    try {
        window.localStorage.setItem(WATCH_PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
        window.localStorage.removeItem(LEGACY_WATCHED_STORAGE_KEY);
    } catch {
        // In-memory progress remains available when browser storage is restricted.
    }
}

export function useWatchProgress() {
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [watchedSlugs, setWatchedSlugs] = useState<string[]>([]);
    const ownerId = useRef<string | null>(null);
    const writeQueue = useRef(Promise.resolve());
    const userId = user?.id ?? null;

    const queueRemoteWrite = useCallback((write: () => Promise<void>) => {
        writeQueue.current = writeQueue.current
            .catch(() => undefined)
            .then(write)
            .then(() => setSyncError(false))
            .catch(() => setSyncError(true));
    }, []);

    useEffect(() => {
        const supabase = createClient();
        let active = true;
        supabase.auth.getUser().then(({ data }) => {
            if (active) {
                setUser(data.user);
                setAuthReady(true);
            }
        });
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthReady(true);
        });
        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!authReady) {
            return;
        }
        const localSnapshot = readLocalSnapshot();
        ownerId.current = localSnapshot.ownerId;

        if (!userId) {
            setWatchedSlugs(localSnapshot.slugs);
            setLoaded(true);
            return;
        }

        let active = true;
        setLoaded(false);
        readRemoteWatchProgress()
            .then(async (remoteSlugs) => {
                const mergedSlugs = mergeWatchProgress(remoteSlugs, localSnapshot, userId);
                const remoteSet = new Set(remoteSlugs);
                await addRemoteWatchProgress(mergedSlugs.filter((slug) => !remoteSet.has(slug)));
                if (active) {
                    ownerId.current = userId;
                    setWatchedSlugs(mergedSlugs);
                    writeLocalSnapshot({ ownerId: userId, slugs: mergedSlugs, version: 1 });
                    setSyncError(false);
                }
            })
            .catch(() => {
                if (active) {
                    const safeSlugs =
                        localSnapshot.ownerId === null || localSnapshot.ownerId === userId
                            ? localSnapshot.slugs
                            : [];
                    setWatchedSlugs(safeSlugs);
                    setSyncError(true);
                }
            })
            .finally(() => {
                if (active) {
                    setLoaded(true);
                }
            });
        return () => {
            active = false;
        };
    }, [authReady, userId]);

    const toggleWatched = useCallback(
        (slug: string) => {
            setWatchedSlugs((current) => {
                const watched = !current.includes(slug);
                const next = watched ? [...current, slug] : current.filter((item) => item !== slug);
                writeLocalSnapshot({ ownerId: ownerId.current, slugs: next, version: 1 });
                if (userId) {
                    queueRemoteWrite(() => setRemoteWatchStatus(slug, watched));
                }
                return next;
            });
        },
        [queueRemoteWrite, userId]
    );

    const resetWatchProgress = useCallback(() => {
        setWatchedSlugs([]);
        writeLocalSnapshot({ ownerId: ownerId.current, slugs: [], version: 1 });
        if (userId) {
            queueRemoteWrite(clearRemoteWatchProgress);
        }
    }, [queueRemoteWrite, userId]);

    const signOut = useCallback(async () => {
        await writeQueue.current;
        const { error } = await createClient().auth.signOut();
        if (error) {
            setSyncError(true);
        }
    }, []);

    return {
        loaded,
        resetWatchProgress,
        signOut,
        syncError,
        toggleWatched,
        user,
        watchedSlugs,
    };
}
