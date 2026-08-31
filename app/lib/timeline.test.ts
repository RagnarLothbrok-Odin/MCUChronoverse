/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { chronology, validateChronology } from "../data/chronology";
import {
    emptyTimelineFilters,
    filterTimeline,
    isWatchable,
    parseTimelineFilters,
    serializeTimelineFilters,
    timelineNodePosition,
} from "./timeline";

describe("chronology", () => {
    test("contains valid unique entries", () => {
        expect(validateChronology(chronology)).toEqual([]);
    });

    test("uses contiguous chronological display positions", () => {
        const orders = chronology.map((entry) => entry.chronologyOrder);
        expect(orders).toEqual(chronology.map((_, index) => (index + 1) * 10));
    });
});

describe("timeline filters", () => {
    test("filters by search, type, and phase", () => {
        const entries = filterTimeline(chronology, {
            order: "chronology",
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
        expect(filters.order).toBe("chronology");
    });

    test("sorts and serializes release order", () => {
        const entries = filterTimeline(chronology, {
            ...emptyTimelineFilters,
            order: "release",
        });
        const releaseDates = entries.map((entry) => entry.releaseDate);

        expect(releaseDates).toEqual([...releaseDates].sort());
        expect(
            serializeTimelineFilters({ ...emptyTimelineFilters, order: "release" }).toString()
        ).toBe("order=release");
        expect(parseTimelineFilters(new URLSearchParams("order=release")).order).toBe("release");
    });
});

describe("watch availability", () => {
    test("only released entries can be marked watched", () => {
        const released = chronology.find((entry) => entry.status === "released");
        const announced = chronology.find((entry) => entry.status === "announced");

        expect(released && isWatchable(released)).toBe(true);
        expect(announced && isWatchable(announced)).toBe(false);
    });
});

describe("timeline node positioning", () => {
    test("is deterministic and finite", () => {
        const first = timelineNodePosition(3, 12);
        expect(timelineNodePosition(3, 12)).toEqual(first);
        expect(Object.values(first).every(Number.isFinite)).toBe(true);
    });

    test("moves forward from left to right", () => {
        const positions = Array.from({ length: 8 }, (_, index) => timelineNodePosition(index, 8));
        expect(
            positions.every((position, index) => {
                const previous = positions[index - 1];
                return index === 0 || (previous !== undefined && position.x > previous.x);
            })
        ).toBe(true);
    });
});
