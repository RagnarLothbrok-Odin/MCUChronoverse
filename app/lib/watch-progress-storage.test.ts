/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { mergeWatchProgress, parseWatchProgressSnapshot } from "./watch-progress-storage";

describe("watch progress storage", () => {
    test("migrates the legacy slug array", () => {
        expect(parseWatchProgressSnapshot(null, '["iron-man","thor","iron-man"]')).toEqual({
            ownerId: null,
            slugs: ["iron-man", "thor"],
            version: 1,
        });
    });

    test("restores remote progress after signed-out local changes", () => {
        const merged = mergeWatchProgress(
            ["iron-man", "thor"],
            { ownerId: "user-a", slugs: [], version: 1 },
            "user-a"
        );
        expect(merged).toEqual(["iron-man", "thor"]);
    });

    test("never merges another account's local progress", () => {
        const merged = mergeWatchProgress(
            ["captain-marvel"],
            { ownerId: "user-a", slugs: ["iron-man"], version: 1 },
            "user-b"
        );
        expect(merged).toEqual(["captain-marvel"]);
    });
});
