/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { chronology, validateChronology } from "../data/chronology";
import { filterTimeline, parseTimelineFilters, timelineNodePosition } from "./timeline";

describe("chronology", () => {
    test("contains valid unique entries", () => {
        expect(validateChronology(chronology)).toEqual([]);
    });

    test("is ordered chronologically", () => {
        const orders = chronology.map((entry) => entry.chronologyOrder);
        expect(orders).toEqual([...orders].sort((left, right) => left - right));
    });
});

describe("timeline filters", () => {
    test("filters by search, type, and phase", () => {
        const entries = filterTimeline(chronology, {
            phases: ["Phase One"],
            query: "iron",
            types: ["film"],
        });
        expect(entries.map((entry) => entry.slug)).toEqual(["iron-man", "iron-man-2"]);
    });

    test("ignores unknown URL values", () => {
        const filters = parseTimelineFilters(
            new URLSearchParams("types=film,game&phases=Phase%20One,Phase%20Nine")
        );
        expect(filters.types).toEqual(["film"]);
        expect(filters.phases).toEqual(["Phase One"]);
    });
});

describe("timeline node positioning", () => {
    test("is deterministic and finite", () => {
        const first = timelineNodePosition(3, 12);
        expect(timelineNodePosition(3, 12)).toEqual(first);
        expect(Object.values(first).every(Number.isFinite)).toBe(true);
    });
});
