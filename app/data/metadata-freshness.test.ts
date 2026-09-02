/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { isMetadataCacheRecordStale, METADATA_MAX_AGE_MS } from "./metadata-freshness";

const now = Date.parse("2026-09-02T12:00:00.000Z");

describe("timeline metadata freshness", () => {
    test("keeps resolved metadata for thirty days", () => {
        expect(
            isMetadataCacheRecordStale(
                {
                    fetchedAt: new Date(now - METADATA_MAX_AGE_MS).toISOString(),
                    status: "resolved",
                },
                now
            )
        ).toBeFalse();
    });

    test("refreshes old, failed, missing, and invalid metadata", () => {
        expect(
            isMetadataCacheRecordStale(
                {
                    fetchedAt: new Date(now - METADATA_MAX_AGE_MS - 1).toISOString(),
                    status: "resolved",
                },
                now
            )
        ).toBeTrue();
        expect(
            isMetadataCacheRecordStale(
                { fetchedAt: new Date(now).toISOString(), status: "failed" },
                now
            )
        ).toBeTrue();
        expect(isMetadataCacheRecordStale(undefined, now)).toBeTrue();
        expect(
            isMetadataCacheRecordStale({ fetchedAt: "invalid", status: "resolved" }, now)
        ).toBeTrue();
    });
});
