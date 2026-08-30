import {
    type ContentType,
    contentTypes,
    type McuPhase,
    phases,
    type TimelineEntry,
} from "../data/types";

export interface TimelineFilters {
    phases: McuPhase[];
    query: string;
    types: ContentType[];
}

export const emptyTimelineFilters: TimelineFilters = {
    phases: [],
    query: "",
    types: [],
};

interface SearchParamsReader {
    get: (name: string) => string | null;
}

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
    if (!value) {
        return [];
    }
    const allowedSet = new Set<string>(allowed);
    return value.split(",").filter((item): item is T => allowedSet.has(item));
}

export function parseTimelineFilters(params: SearchParamsReader): TimelineFilters {
    return {
        phases: parseList(params.get("phases"), phases),
        query: params.get("q")?.trim() ?? "",
        types: parseList(params.get("types"), contentTypes),
    };
}

export function serializeTimelineFilters(filters: TimelineFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.query.trim()) {
        params.set("q", filters.query.trim());
    }
    if (filters.types.length > 0) {
        params.set("types", filters.types.join(","));
    }
    if (filters.phases.length > 0) {
        params.set("phases", filters.phases.join(","));
    }
    return params;
}

export function filterTimeline(
    entries: readonly TimelineEntry[],
    filters: TimelineFilters
): TimelineEntry[] {
    const query = filters.query.trim().toLocaleLowerCase("en-GB");
    return entries.filter((entry) => {
        const matchesQuery =
            query.length === 0 ||
            entry.title.toLocaleLowerCase("en-GB").includes(query) ||
            entry.description.toLocaleLowerCase("en-GB").includes(query);
        const matchesType = filters.types.length === 0 || filters.types.includes(entry.contentType);
        const matchesPhase = filters.phases.length === 0 || filters.phases.includes(entry.phase);
        return matchesQuery && matchesType && matchesPhase;
    });
}

export interface TimelineNodePosition {
    x: number;
    y: number;
    z: number;
}

export function timelineNodePosition(index: number, count: number): TimelineNodePosition {
    const safeCount = Math.max(count, 1);
    const centre = (safeCount - 1) / 2;
    const offset = index - centre;
    return {
        x: offset * 2.2,
        y: 0,
        z: 0,
    };
}
