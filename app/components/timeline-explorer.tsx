"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    type ChangeEvent,
    type MouseEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    type ContentType,
    contentTypeLabels,
    contentTypes,
    type McuPhase,
    phases,
    type TimelineEntry,
} from "../data/types";
import {
    emptyTimelineFilters,
    filterTimeline,
    parseTimelineFilters,
    serializeTimelineFilters,
    type TimelineFilters,
} from "../lib/timeline";

const TimelineOrbit = dynamic(
    () => import("./timeline-orbit").then((module) => module.TimelineOrbit),
    {
        loading: () => (
            <div className="grid h-full place-items-center bg-[#020203]">
                <p className="font-mono text-[0.62rem] text-white/35 uppercase tracking-[0.2em]">
                    Opening temporal archive
                </p>
            </div>
        ),
        ssr: false,
    }
);

interface TimelineExplorerProps {
    entries: readonly TimelineEntry[];
}

interface FocusRequest {
    index: number;
    key: number;
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isContentType(value: string | undefined): value is ContentType {
    return contentTypes.some((type) => type === value);
}

function isMcuPhase(value: string | undefined): value is McuPhase {
    return phases.some((phase) => phase === value);
}

const contentTypeNames: Record<ContentType, string> = {
    film: "Film",
    "one-shot": "One-Shot",
    series: "Series",
    short: "Short",
    special: "Special",
};

interface TimelineDetailProps {
    entry: TimelineEntry;
    onClose: () => void;
}

function TimelineDetail({ entry, onClose }: TimelineDetailProps) {
    return (
        <motion.aside
            animate={{ opacity: 1, x: 0 }}
            className="timeline-detail-card absolute bottom-36 left-4 z-30 w-[min(47rem,calc(100%-2rem))] sm:bottom-40 sm:left-7 sm:w-[min(47rem,calc(100%-3.5rem))]"
            data-timeline-detail="true"
            exit={{ opacity: 0, x: -16 }}
            initial={{ opacity: 0, x: -16 }}
        >
            <div className="timeline-detail-glow" />
            <div className="timeline-detail-grid">
                <div className="timeline-detail-poster-shell">
                    {entry.posterUrl ? (
                        <Image
                            alt={`${entry.title} poster`}
                            className="timeline-detail-poster"
                            fill
                            sizes="(max-width: 640px) 108px, 192px"
                            src={entry.posterUrl}
                        />
                    ) : (
                        <div className="timeline-detail-poster-fallback">
                            <span>Poster unavailable</span>
                        </div>
                    )}
                    <div className="timeline-detail-poster-shade" />
                    <span className="timeline-detail-order">
                        #{String(entry.chronologyOrder / 10).padStart(2, "0")}
                    </span>
                </div>
                <div className="timeline-detail-content">
                    <div className="timeline-detail-heading">
                        <div>
                            <p className="timeline-detail-eyebrow">
                                {entry.placement}
                                <span aria-hidden="true">◆</span>
                                {contentTypeNames[entry.contentType]}
                            </p>
                            <h1 className="timeline-detail-title">{entry.title}</h1>
                        </div>
                        <button
                            aria-label="Close event details"
                            className="focus-ring timeline-detail-close"
                            onClick={onClose}
                            type="button"
                        >
                            ×
                        </button>
                    </div>

                    <div className="timeline-detail-facts">
                        {entry.rating === undefined ? null : (
                            <div className="timeline-detail-rating">
                                <span aria-hidden="true" className="timeline-detail-star">
                                    ★
                                </span>
                                <strong>{entry.rating.toFixed(1)}</strong>
                                <span>/ 10</span>
                            </div>
                        )}
                        <span>{entry.runtime}</span>
                        {entry.phase ? <span>{entry.phase}</span> : null}
                        <span>{entry.releaseDate.slice(0, 4)}</span>
                    </div>

                    <p className="timeline-detail-description">{entry.description}</p>

                    {entry.genres && entry.genres.length > 0 ? (
                        <div className="timeline-detail-genres">
                            {entry.genres.map((genre) => (
                                <span key={genre}>{genre}</span>
                            ))}
                        </div>
                    ) : null}

                    <div className="timeline-detail-footer">
                        <div className="timeline-detail-universe">
                            <span>Universe</span>
                            <strong>{entry.universe}</strong>
                        </div>
                        {entry.imdbUrl ? (
                            <a
                                className="focus-ring timeline-detail-imdb"
                                href={entry.imdbUrl}
                                rel="noreferrer"
                                target="_blank"
                            >
                                <span className="timeline-detail-imdb-mark">IMDb</span>
                                <span>Open on IMDb</span>
                                <span aria-hidden="true" className="timeline-detail-arrow">
                                    ↗
                                </span>
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>
        </motion.aside>
    );
}

export function TimelineExplorer({ entries }: TimelineExplorerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchString = searchParams.toString();
    const [filters, setFilters] = useState<TimelineFilters>(() =>
        parseTimelineFilters(searchParams)
    );
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [timelineIndex, setTimelineIndex] = useState(0);
    const [focusRequest, setFocusRequest] = useState<FocusRequest>({ index: 0, key: 0 });
    const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
    const [hasRenderedTimeline, setHasRenderedTimeline] = useState(false);

    useEffect(() => {
        setFilters(parseTimelineFilters(new URLSearchParams(searchString)));
    }, [searchString]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setFiltersOpen(false);
                setSelectedEntry(null);
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, []);

    const updateFilters = useCallback(
        (nextFilters: TimelineFilters) => {
            setFilters(nextFilters);
            const params = serializeTimelineFilters(nextFilters);
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router]
    );

    const visibleEntries = useMemo(() => filterTimeline(entries, filters), [entries, filters]);
    const safeTimelineIndex = Math.min(timelineIndex, Math.max(visibleEntries.length - 1, 0));
    const activeEntry = visibleEntries[safeTimelineIndex];
    const activeFilterCount =
        filters.types.length + filters.phases.length + (filters.query ? 1 : 0);

    const toggleFilters = useCallback(() => setFiltersOpen((current) => !current), []);
    const closeDetail = useCallback(() => setSelectedEntry(null), []);
    const handleOutsidePointerDown = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            if (!selectedEntry) {
                return;
            }
            const { target } = event;
            if (target instanceof Element && target.closest("[data-timeline-detail]")) {
                return;
            }
            setSelectedEntry(null);
        },
        [selectedEntry]
    );
    const resetFilters = useCallback(() => updateFilters(emptyTimelineFilters), [updateFilters]);
    const handleSearchChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            updateFilters({ ...filters, query: event.currentTarget.value });
        },
        [filters, updateFilters]
    );
    const handleTypeToggle = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const type = event.currentTarget.dataset.value;
            if (!isContentType(type)) {
                return;
            }
            updateFilters({ ...filters, types: toggleValue(filters.types, type) });
        },
        [filters, updateFilters]
    );
    const handlePhaseToggle = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const phase = event.currentTarget.dataset.value;
            if (!isMcuPhase(phase)) {
                return;
            }
            updateFilters({ ...filters, phases: toggleValue(filters.phases, phase) });
        },
        [filters, updateFilters]
    );
    const selectEntry = useCallback(
        (slug: string) => {
            const entry = entries.find((item) => item.slug === slug) ?? null;
            setSelectedEntry(entry);
            if (entry) {
                const index = visibleEntries.findIndex((item) => item.slug === entry.slug);
                if (index >= 0) {
                    setTimelineIndex(index);
                    setFocusRequest((current) => ({ index, key: current.key + 1 }));
                }
            }
        },
        [entries, visibleEntries]
    );
    const handleTimelineChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const index = Number(event.currentTarget.value);
        if (!Number.isInteger(index)) {
            return;
        }
        setSelectedEntry(null);
        setTimelineIndex(index);
        setFocusRequest((current) => ({ index, key: current.key + 1 }));
    }, []);

    useEffect(() => {
        setSelectedEntry((current) =>
            current && visibleEntries.some((entry) => entry.slug === current.slug) ? current : null
        );
        setTimelineIndex(0);
        if (hasRenderedTimeline) {
            setFocusRequest((current) => ({ index: 0, key: current.key + 1 }));
        }
        setHasRenderedTimeline(true);
    }, [visibleEntries]);

    return (
        <main
            className="relative h-dvh min-h-[32rem] overflow-hidden bg-[#020203] text-ink"
            onPointerDown={handleOutsidePointerDown}
        >
            <div className="absolute inset-0">
                <TimelineOrbit
                    entries={visibleEntries}
                    focusIndex={focusRequest.index}
                    focusKey={focusRequest.key}
                    onSelect={selectEntry}
                    selectedSlug={selectedEntry?.slug}
                />
            </div>
            <div className="grain" />

            <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-40 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-48 bg-gradient-to-t from-black/75 to-transparent" />

            <header className="absolute top-5 left-5 z-30 sm:top-7 sm:left-7">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center border border-[#ff9b4a]/60 bg-black/45 font-mono font-semibold text-[#ffb260] text-xs shadow-[0_0_30px_rgb(255_112_35/12%)] backdrop-blur-xl">
                        616
                    </span>
                    <div>
                        <p className="font-semibold text-sm uppercase tracking-[0.22em]">
                            MCU <span className="text-white/42">Chronoverse</span>
                        </p>
                        <a
                            className="focus-ring mt-1 inline-block font-mono text-[0.55rem] text-white/30 uppercase tracking-[0.15em] transition-colors hover:text-white/65"
                            href="/about"
                        >
                            About the archive
                        </a>
                    </div>
                </div>
            </header>

            <aside className="absolute top-5 right-5 z-40 w-[min(23rem,calc(100%-2.5rem))] sm:top-7 sm:right-7">
                <div className="flex justify-end">
                    <button
                        aria-controls="timeline-filters"
                        aria-expanded={filtersOpen}
                        className="focus-ring flex h-11 items-center gap-3 border border-white/14 bg-black/58 px-4 font-mono text-[0.63rem] uppercase tracking-[0.16em] shadow-[0_14px_50px_rgb(0_0_0/36%)] backdrop-blur-xl transition-colors hover:border-[#ff9b4a]/55"
                        onClick={toggleFilters}
                        type="button"
                    >
                        <span aria-hidden="true" className="flex items-center gap-1">
                            <span className="h-3 w-px bg-[#ffad55]" />
                            <span className="h-4 w-px bg-[#ffad55]" />
                            <span className="h-2 w-px bg-[#ffad55]" />
                        </span>
                        Filters
                        {activeFilterCount > 0 ? (
                            <span className="grid size-5 place-items-center rounded-full bg-[#ff8a3d] text-[0.56rem] text-black">
                                {activeFilterCount}
                            </span>
                        ) : null}
                        <span
                            aria-hidden="true"
                            className={`text-white/38 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                        >
                            ↓
                        </span>
                    </button>
                </div>

                <AnimatePresence>
                    {filtersOpen ? (
                        <motion.div
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="mt-2 border border-white/14 bg-[#070709]/88 p-4 shadow-[0_24px_90px_rgb(0_0_0/62%)] backdrop-blur-2xl sm:p-5"
                            exit={{ opacity: 0, scale: 0.98, y: -8 }}
                            id="timeline-filters"
                            initial={{ opacity: 0, scale: 0.98, y: -8 }}
                            transition={{ duration: 0.18 }}
                        >
                            <div className="flex items-center justify-between border-white/10 border-b pb-4">
                                <div>
                                    <p className="font-mono text-[#ffad55] text-[0.57rem] uppercase tracking-[0.18em]">
                                        Timeline parameters
                                    </p>
                                    <p className="mt-1 text-white/37 text-xs">
                                        {visibleEntries.length} of {entries.length} events visible
                                    </p>
                                </div>
                                {activeFilterCount > 0 ? (
                                    <button
                                        className="focus-ring font-mono text-[0.56rem] text-white/38 uppercase tracking-[0.13em] hover:text-[#ffad55]"
                                        onClick={resetFilters}
                                        type="button"
                                    >
                                        Reset
                                    </button>
                                ) : null}
                            </div>

                            <label className="relative mt-4 block">
                                <span className="sr-only">Search timeline</span>
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-white/25 text-xs">
                                    /
                                </span>
                                <input
                                    className="focus-ring h-10 w-full border border-white/10 bg-white/[0.035] pr-3 pl-8 text-sm placeholder:text-white/25"
                                    onChange={handleSearchChange}
                                    placeholder="Search the archive"
                                    type="search"
                                    value={filters.query}
                                />
                            </label>

                            <fieldset className="mt-5">
                                <legend className="font-mono text-[0.55rem] text-white/30 uppercase tracking-[0.16em]">
                                    Format
                                </legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {contentTypes.map((type) => {
                                        const active = filters.types.includes(type);
                                        return (
                                            <button
                                                aria-pressed={active}
                                                className={`focus-ring flex items-center justify-between border px-3 py-2.5 text-left text-xs transition-colors ${
                                                    active
                                                        ? "border-[#ff9b4a]/60 bg-[#ff8a3d]/12 text-white"
                                                        : "border-white/8 text-white/42 hover:border-white/20"
                                                }`}
                                                data-value={type}
                                                key={type}
                                                onClick={handleTypeToggle}
                                                type="button"
                                            >
                                                {contentTypeLabels[type]}
                                                <span
                                                    aria-hidden="true"
                                                    className={`size-1.5 rounded-full ${active ? "bg-[#ffad55] shadow-[0_0_8px_#ff8a3d]" : "bg-white/15"}`}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            <fieldset className="mt-5">
                                <legend className="font-mono text-[0.55rem] text-white/30 uppercase tracking-[0.16em]">
                                    Phase
                                </legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {phases.map((phase) => {
                                        const active = filters.phases.includes(phase);
                                        return (
                                            <button
                                                aria-pressed={active}
                                                className={`focus-ring rounded-full border px-3 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] transition-colors ${
                                                    active
                                                        ? "border-[#d6b46b]/60 bg-[#d6b46b]/10 text-[#edca7f]"
                                                        : "border-white/10 text-white/32 hover:border-white/22"
                                                }`}
                                                data-value={phase}
                                                key={phase}
                                                onClick={handlePhaseToggle}
                                                type="button"
                                            >
                                                {phase.replace("Phase ", "")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </aside>

            <AnimatePresence mode="wait">
                {selectedEntry ? (
                    <TimelineDetail
                        entry={selectedEntry}
                        key={selectedEntry.slug}
                        onClose={closeDetail}
                    />
                ) : null}
            </AnimatePresence>

            <nav
                aria-label="Scroll through the timeline"
                className="timeline-dock absolute bottom-5 left-1/2 z-40 w-[min(34rem,calc(100%-3rem))] -translate-x-1/2 sm:bottom-7"
            >
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="font-mono text-[#ffad55] text-[0.5rem] uppercase tracking-[0.2em]">
                            Sacred timeline
                        </p>
                        <p className="mt-1 truncate font-semibold text-sm text-white/78 tracking-[-0.02em]">
                            {activeEntry?.title ?? "No matching events"}
                        </p>
                    </div>
                    <p className="shrink-0 font-mono text-[0.5rem] text-white/35 uppercase tracking-[0.13em]">
                        {visibleEntries.length === 0
                            ? "No events"
                            : `${String(safeTimelineIndex + 1).padStart(2, "0")} / ${String(visibleEntries.length).padStart(2, "0")}`}
                    </p>
                </div>

                <div className="timeline-scrubber mt-3">
                    <div
                        aria-hidden="true"
                        className="timeline-scrubber-progress"
                        style={{
                            width:
                                visibleEntries.length > 1
                                    ? `${(safeTimelineIndex / (visibleEntries.length - 1)) * 100}%`
                                    : "0%",
                        }}
                    />
                    <div aria-hidden="true" className="timeline-scrubber-track" />
                    <input
                        aria-label="Timeline position"
                        className="timeline-scrubber-input"
                        max={Math.max(visibleEntries.length - 1, 0)}
                        min="0"
                        onChange={handleTimelineChange}
                        step="1"
                        type="range"
                        value={visibleEntries.length > 0 ? safeTimelineIndex : 0}
                    />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[0.47rem] text-white/28 uppercase tracking-[0.14em]">
                    <span>{visibleEntries[0]?.placement ?? "Origin"}</span>
                    <span className="text-[#ffb05e]/65">Drag to travel</span>
                    <span>{visibleEntries.at(-1)?.placement ?? "Destination"}</span>
                </div>
            </nav>
        </main>
    );
}
