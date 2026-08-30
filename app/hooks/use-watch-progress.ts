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
    const watchedSlugsRef = useRef<string[]>([]);
    const writeQueue = useRef(Promise.resolve());
    const userId = user?.id ?? null;

    const queueRemoteWrite = useCallback((write: () => Promise<void>) => {
        writeQueue.current = writeQueue.current
            .catch(() => undefined)
            .then(write)
            .then(() => setSyncError(false))
            .catch(() => setSyncError(true));
    }, []);

    const setLocalProgress = useCallback((slugs: string[], snapshotOwner: string | null) => {
        ownerId.current = snapshotOwner;
        watchedSlugsRef.current = slugs;
        setWatchedSlugs(slugs);
        writeLocalSnapshot({ ownerId: snapshotOwner, slugs, version: 1 });
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

        if (!userId) {
            setLocalProgress(localSnapshot.slugs, localSnapshot.ownerId);
            setLoaded(true);
            return;
        }

        let active = true;
        ownerId.current = userId;
        setLoaded(false);
        readRemoteWatchProgress(userId)
            .then(async (remoteSlugs) => {
                const mergedSlugs = mergeWatchProgress(remoteSlugs, localSnapshot, userId);
                const remoteSet = new Set(remoteSlugs);
                await addRemoteWatchProgress(
                    userId,
                    mergedSlugs.filter((slug) => !remoteSet.has(slug))
                );
                if (active) {
                    setLocalProgress(mergedSlugs, userId);
                    setSyncError(false);
                }
            })
            .catch(() => {
                if (active) {
                    const safeSlugs =
                        localSnapshot.ownerId === null || localSnapshot.ownerId === userId
                            ? localSnapshot.slugs
                            : [];
                    watchedSlugsRef.current = safeSlugs;
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
    }, [authReady, setLocalProgress, userId]);

    const toggleWatched = useCallback(
        (slug: string) => {
            const { current } = watchedSlugsRef;
            const watched = !current.includes(slug);
            const next = watched ? [...current, slug] : current.filter((item) => item !== slug);
            setLocalProgress(next, userId ?? ownerId.current);
            if (userId) {
                queueRemoteWrite(() => setRemoteWatchStatus(userId, slug, watched));
            }
        },
        [queueRemoteWrite, setLocalProgress, userId]
    );

    const resetWatchProgress = useCallback(() => {
        setLocalProgress([], userId ?? ownerId.current);
        if (userId) {
            queueRemoteWrite(() => clearRemoteWatchProgress(userId));
        }
    }, [queueRemoteWrite, setLocalProgress, userId]);

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
