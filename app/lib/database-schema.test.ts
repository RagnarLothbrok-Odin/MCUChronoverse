import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("database schema", () => {
    test("stores watch progress without duplicating the chronology catalogue", async () => {
        const schemaUrl = new URL("../../supabase/schema.sql", import.meta.url);
        const schema = await readFile(schemaUrl, "utf8");

        expect(schema).not.toContain("create table if not exists public.timeline_entries");
        expect(schema).toContain(
            "entry_slug text not null check (char_length(entry_slug) between 1 and 160)"
        );
        expect(schema).toContain("drop constraint if exists watch_progress_entry_slug_fkey");
    });
});
