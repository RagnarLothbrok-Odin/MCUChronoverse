import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { chronology } from "../data/chronology";

const timelineValuePattern = /^\s*\('([^']+)'\),?$/gm;

describe("database schema", () => {
    test("keeps the timeline entry allowlist synchronized with chronology", async () => {
        const schemaUrl = new URL("../../supabase/schema.sql", import.meta.url);
        const schema = await readFile(schemaUrl, "utf8");
        const databaseSlugs = [...schema.matchAll(timelineValuePattern)].map((match) => match[1]);
        const chronologySlugs = chronology.map((entry) => entry.slug);

        expect(databaseSlugs.sort()).toEqual(chronologySlugs.sort());
    });
});
