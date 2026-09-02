/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import {
    parseWatchProgressStore,
    readScopedProgress,
    writeScopedProgress,
} from "./watch-progress-storage";

describe("watch progress storage", () => {
    test("migrates the original anonymous slug array", () => {
        expect(parseWatchProgressStore(null, '["iron-man","thor","iron-man"]')).toEqual({
            accounts: {},
            anonymousSlugs: ["iron-man", "thor"],
            version: 2,
        });
    });

    test("expands watched entries that were split into seasons", () => {
        const store = parseWatchProgressStore(
            JSON.stringify({
                accounts: { "user-a": ["what-if"] },
                anonymousSlugs: ["i-am-groot"],
                version: 2,
            })
        );

        expect(readScopedProgress(store, null)).toEqual([
            "i-am-groot-season-1",
            "i-am-groot-season-2",
        ]);
        expect(readScopedProgress(store, "user-a")).toEqual([
            "what-if-season-1",
            "what-if-season-2",
            "what-if-season-3",
        ]);
    });

    test("migrates the owner snapshot without exposing it while signed out", () => {
        const store = parseWatchProgressStore(
            JSON.stringify({ ownerId: "user-a", slugs: ["iron-man", "thor"], version: 1 })
        );
        expect(readScopedProgress(store, "user-a")).toEqual(["iron-man", "thor"]);
        expect(readScopedProgress(store, null)).toEqual([]);
    });

    test("keeps anonymous and account progress independent", () => {
        const anonymous = writeScopedProgress(parseWatchProgressStore(null), null, ["iron-man"]);
        const signedIn = writeScopedProgress(anonymous, "user-a", ["thor", "the-avengers"]);
        const signedOutAgain = writeScopedProgress(signedIn, null, []);

        expect(readScopedProgress(signedOutAgain, null)).toEqual([]);
        expect(readScopedProgress(signedOutAgain, "user-a")).toEqual(["thor", "the-avengers"]);
    });

    test("keeps different account caches isolated", () => {
        const userA = writeScopedProgress(parseWatchProgressStore(null), "user-a", ["iron-man"]);
        const userB = writeScopedProgress(userA, "user-b", ["captain-marvel"]);

        expect(readScopedProgress(userB, "user-a")).toEqual(["iron-man"]);
        expect(readScopedProgress(userB, "user-b")).toEqual(["captain-marvel"]);
    });
});
