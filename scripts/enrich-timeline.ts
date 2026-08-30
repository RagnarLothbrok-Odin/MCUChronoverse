/// <reference types="bun" />

import { resolve } from "node:path";
import { getTitleDetailsByName, type ITitle } from "@valhalladev/movier";
import { chronology } from "../app/data/chronology";
import { log } from "../app/lib/console";

interface CacheRecord {
    error?: string;
    fetchedAt: string;
    requestedTitle: string;
    source: CachedTitle | null;
    status: "resolved" | "failed";
}

type CachedTitle = Pick<
    ITitle,
    | "allReleaseDates"
    | "dates"
    | "genres"
    | "keywords"
    | "mainRate"
    | "mainSource"
    | "mainType"
    | "name"
    | "plot"
    | "posterImage"
    | "runtime"
    | "taglines"
    | "titleYear"
    | "trailers"
    | "worldWideName"
>;

type MetadataCache = Record<string, CacheRecord>;

const cachePath = resolve(import.meta.dir, "../app/data/title-metadata.json");
// biome-ignore lint/correctness/noUndeclaredVariables: This script runs in the Bun runtime.
const refresh = Bun.argv.includes("--refresh");
const delayMs = 750;
const seasonSuffix = /\s+Season\s+\d+$/i;

const sleep = (milliseconds: number) =>
    new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const readCache = async (): Promise<MetadataCache> => {
    // biome-ignore lint/correctness/noUndeclaredVariables: This script runs in the Bun runtime.
    const cacheFile = Bun.file(cachePath);
    return (await cacheFile.exists()) ? ((await cacheFile.json()) as MetadataCache) : {};
};

const writeCache = async (nextCache: MetadataCache) => {
    // biome-ignore lint/correctness/noUndeclaredVariables: This script runs in the Bun runtime.
    await Bun.write(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`);
};

const selectTitleData = (title: ITitle): CachedTitle => ({
    allReleaseDates: title.allReleaseDates,
    dates: title.dates,
    genres: title.genres,
    keywords: title.keywords,
    mainRate: title.mainRate,
    mainSource: title.mainSource,
    mainType: title.mainType,
    name: title.name,
    plot: title.plot,
    posterImage: title.posterImage,
    runtime: title.runtime,
    taglines: title.taglines,
    titleYear: title.titleYear,
    trailers: title.trailers,
    worldWideName: title.worldWideName,
});

const lookupTitle = async (title: string, releaseDate: string): Promise<ITitle> => {
    const baseTitle = title.replace(seasonSuffix, "");
    const queries = [...new Set([title, baseTitle])];
    let lastError: unknown;

    for (const query of queries) {
        try {
            // Sequential retries keep the fallback lookup from spamming the API.
            // biome-ignore lint/performance/noAwaitInLoops: Requests must remain sequential and rate-limited.
            return await getTitleDetailsByName(`${query} ${releaseDate.slice(0, 4)}`, {
                tmdbReadAccessToken: token,
            });
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError ?? new Error(`No result found for ${title}`);
};

const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
if (!token) {
    log.error(
        "TMDB_READ_ACCESS_TOKEN is required. Add it to .env before running the enrichment script."
    );
    process.exit(1);
}

const cache = await readCache();
let resolved = 0;
let skipped = 0;
let failed = 0;

for (const entry of chronology) {
    if (!refresh && cache[entry.slug]?.status === "resolved") {
        skipped += 1;
        log.info(`Skipping ${entry.title}, already cached.`);
        continue;
    }

    try {
        // Each item is written immediately and delayed to keep the enrichment run API-friendly.
        // biome-ignore lint/performance/noAwaitInLoops: The script intentionally processes one title at a time.
        const title = await lookupTitle(entry.title, entry.releaseDate);

        cache[entry.slug] = {
            fetchedAt: new Date().toISOString(),
            requestedTitle: entry.title,
            source: selectTitleData(title),
            status: "resolved",
        };
        resolved += 1;
        log.ok(`Resolved ${entry.title}`);
    } catch (error) {
        cache[entry.slug] = {
            error: error instanceof Error ? error.message : String(error),
            fetchedAt: new Date().toISOString(),
            requestedTitle: entry.title,
            source: null,
            status: "failed",
        };
        failed += 1;
        log.warn(`Failed to resolve ${entry.title}`, error);
    }

    await writeCache(cache);
    await sleep(delayMs);
}

log.info(`Finished. Resolved: ${resolved}, skipped: ${skipped}, failed: ${failed}.`);
log.info(`Cached metadata: ${cachePath}`);
