export const WATCH_PROGRESS_STORAGE_KEY = "mcu-chronoverse:watch-progress";
export const LEGACY_WATCHED_STORAGE_KEY = "mcu-chronoverse:watched";

export interface WatchProgressSnapshot {
    ownerId: string | null;
    slugs: string[];
    version: 1;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseWatchProgressSnapshot(
    storedValue: string | null,
    legacyValue: string | null = null
): WatchProgressSnapshot {
    try {
        const parsed: unknown = storedValue ? JSON.parse(storedValue) : null;
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "version" in parsed &&
            parsed.version === 1 &&
            "ownerId" in parsed &&
            (typeof parsed.ownerId === "string" || parsed.ownerId === null) &&
            "slugs" in parsed &&
            isStringArray(parsed.slugs)
        ) {
            return { ownerId: parsed.ownerId, slugs: [...new Set(parsed.slugs)], version: 1 };
        }
    } catch {
        // Invalid local data is discarded below.
    }

    try {
        const parsedLegacy: unknown = legacyValue ? JSON.parse(legacyValue) : null;
        if (isStringArray(parsedLegacy)) {
            return { ownerId: null, slugs: [...new Set(parsedLegacy)], version: 1 };
        }
    } catch {
        // Invalid legacy data is discarded below.
    }

    return { ownerId: null, slugs: [], version: 1 };
}

export function mergeWatchProgress(
    remoteSlugs: string[],
    localSnapshot: WatchProgressSnapshot,
    userId: string
) {
    const localBelongsToUser = localSnapshot.ownerId === null || localSnapshot.ownerId === userId;
    return [...new Set([...remoteSlugs, ...(localBelongsToUser ? localSnapshot.slugs : [])])];
}
