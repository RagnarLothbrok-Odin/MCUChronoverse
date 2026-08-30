"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    type ChangeEvent,
    type MouseEvent,
    type ReactNode,
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
import { EntryDetail } from "./entry-detail";
import { TimelineCard } from "./timeline-card";

const TimelineOrbit = dynamic(
    () => import("./timeline-orbit").then((module) => module.TimelineOrbit),
    {
        loading: () => (
            <div className="grid min-h-[34rem] place-items-center border border-white/10 bg-black/30">
                <p className="font-mono text-[0.65rem] text-white/35 uppercase tracking-[0.18em]">
                    Mapping spatial coordinates
                </p>
            </div>
        ),
        ssr: false,
    }
);

type TimelineView = "orbit" | "timeline";

interface TimelineExplorerProps {
    entries: readonly TimelineEntry[];
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

function parseView(value: string | null): TimelineView {
    return value === "orbit" ? "orbit" : "timeline";
}

export function TimelineExplorer({ entries }: TimelineExplorerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchString = searchParams.toString();
    const [filters, setFilters] = useState<TimelineFilters>(() =>
        parseTimelineFilters(searchParams)
    );
    const [view, setView] = useState<TimelineView>(() => parseView(searchParams.get("view")));
    const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);

    useEffect(() => {
        setFilters(parseTimelineFilters(new URLSearchParams(searchString)));
        setView(parseView(new URLSearchParams(searchString).get("view")));
    }, [searchString]);

    const updateUrl = useCallback(
        (nextFilters: TimelineFilters, nextView: TimelineView) => {
            const nextParams = serializeTimelineFilters(nextFilters);
            if (nextView === "orbit") {
                nextParams.set("view", nextView);
            }
            const query = nextParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router]
    );

    const updateFilters = useCallback(
        (nextFilters: TimelineFilters) => {
            setFilters(nextFilters);
            updateUrl(nextFilters, view);
        },
        [updateUrl, view]
    );

    const visibleEntries = useMemo(() => filterTimeline(entries, filters), [entries, filters]);
    const hasFilters =
        filters.query.length > 0 || filters.types.length > 0 || filters.phases.length > 0;

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

    const resetFilters = useCallback(() => updateFilters(emptyTimelineFilters), [updateFilters]);
    const closeDetail = useCallback(() => setSelectedEntry(null), []);
    const selectEntryBySlug = useCallback(
        (slug: string) => {
            setSelectedEntry(entries.find((item) => item.slug === slug) ?? null);
        },
        [entries]
    );
    const selectEntry = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const entry = entries.find((item) => item.slug === event.currentTarget.dataset.slug);
            setSelectedEntry(entry ?? null);
        },
        [entries]
    );
    const handleViewChange = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const nextView = parseView(event.currentTarget.dataset.view ?? null);
            setView(nextView);
            updateUrl(filters, nextView);
        },
        [filters, updateUrl]
    );
    const returnToTimeline = useCallback(() => {
        setView("timeline");
        updateUrl(filters, "timeline");
    }, [filters, updateUrl]);

    let timelineContent: ReactNode;
    if (visibleEntries.length === 0) {
        timelineContent = (
            <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="border border-white/10 bg-white/[0.025] px-6 py-20 text-center"
                initial={{ opacity: 0, y: 8 }}
                key="empty"
            >
                <p className="font-mono text-gold text-xs uppercase tracking-[0.22em]">
                    No matching branch
                </p>
                <h2 className="mt-4 font-semibold text-3xl tracking-[-0.04em]">
                    Nothing exists at these coordinates.
                </h2>
                <button
                    className="focus-ring mt-6 border border-white/15 px-5 py-2.5 text-sm hover:border-signal"
                    onClick={resetFilters}
                    type="button"
                >
                    Reset the timeline
                </button>
            </motion.div>
        );
    } else if (view === "orbit") {
        timelineContent = (
            <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} key="orbit">
                <TimelineOrbit
                    entries={visibleEntries}
                    onReturnToTimeline={returnToTimeline}
                    onSelect={selectEntryBySlug}
                    selectedSlug={selectedEntry?.slug}
                />
            </motion.div>
        );
    } else {
        timelineContent = (
            <motion.ol
                animate={{ opacity: 1 }}
                className="relative space-y-5 before:absolute before:top-8 before:bottom-8 before:left-[0.61rem] before:w-px before:bg-gradient-to-b before:from-signal before:via-white/20 before:to-transparent md:space-y-8 md:before:left-1/2"
                initial={{ opacity: 0 }}
                key="entries"
            >
                {visibleEntries.map((entry, index) => (
                    <TimelineCard
                        entry={entry}
                        index={index}
                        key={entry.slug}
                        onSelect={selectEntry}
                    />
                ))}
            </motion.ol>
        );
    }

    return (
        <main className="relative min-h-screen overflow-hidden">
            <div className="star-field" />
            <div className="grain" />

            <header className="sticky top-0 z-30 border-white/10 border-b bg-void/82 backdrop-blur-xl">
                <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
                    <a className="focus-ring group inline-flex items-center gap-3" href="#timeline">
                        <span className="grid size-9 place-items-center border border-signal/70 bg-signal/10 font-mono font-semibold text-signal text-xs">
                            616
                        </span>
                        <span className="font-semibold text-sm uppercase tracking-[0.23em]">
                            MCU <span className="text-white/45">Chronoverse</span>
                        </span>
                    </a>
                    <nav
                        aria-label="Primary navigation"
                        className="flex items-center gap-5 sm:gap-8"
                    >
                        <a
                            className="focus-ring font-mono text-muted text-xs uppercase tracking-[0.18em] transition-colors hover:text-ink"
                            href="#timeline"
                        >
                            Timeline
                        </a>
                        <a
                            className="focus-ring hidden font-mono text-muted text-xs uppercase tracking-[0.18em] transition-colors hover:text-ink sm:block"
                            href="/about"
                        >
                            About
                        </a>
                    </nav>
                </div>
            </header>

            <section className="mx-auto max-w-[1500px] px-5 pt-14 pb-8 sm:px-8 lg:px-12 lg:pt-20">
                <p className="flex items-center gap-3 font-mono text-gold text-xs uppercase tracking-[0.28em]">
                    <span className="h-px w-8 bg-gold/70" />
                    Chronological archive
                </p>
                <div className="mt-5 grid items-end gap-7 lg:grid-cols-[1fr_auto]">
                    <h1 className="max-w-4xl text-balance font-semibold text-5xl leading-[0.96] tracking-[-0.055em] sm:text-7xl">
                        One story across
                        <span className="block text-white/35">every screen.</span>
                    </h1>
                    <p className="max-w-md text-white/50 leading-7 lg:pb-2">
                        Explore the MCU in story order. Filter the archive, select an entry, and
                        follow the timeline from the beginning.
                    </p>
                </div>
            </section>

            <section
                aria-label="Timeline controls"
                className="relative z-20 border-white/10 border-y bg-[#08090c]/92 backdrop-blur-xl lg:sticky lg:top-20"
            >
                <div className="mx-auto max-w-[1500px] px-5 py-4 sm:px-8 lg:px-12">
                    <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_auto]">
                        <label className="relative block">
                            <span className="sr-only">Search the timeline</span>
                            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-mono text-white/30 text-xs">
                                /
                            </span>
                            <input
                                className="focus-ring h-11 w-full border border-white/12 bg-white/[0.035] pr-4 pl-10 text-sm text-white placeholder:text-white/28"
                                onChange={handleSearchChange}
                                placeholder="Search titles or stories"
                                type="search"
                                value={filters.query}
                            />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {contentTypes.map((type) => {
                                const active = filters.types.includes(type);
                                return (
                                    <button
                                        aria-pressed={active}
                                        className={`focus-ring h-11 border px-3.5 font-mono text-[0.65rem] uppercase tracking-[0.13em] transition-colors ${
                                            active
                                                ? "border-signal bg-signal/15 text-white"
                                                : "border-white/10 text-white/43 hover:border-white/25 hover:text-white"
                                        }`}
                                        data-value={type}
                                        key={type}
                                        onClick={handleTypeToggle}
                                        type="button"
                                    >
                                        {contentTypeLabels[type]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-white/8 border-t pt-3">
                        <div className="flex flex-wrap gap-2">
                            {phases.map((phase) => {
                                const active = filters.phases.includes(phase);
                                return (
                                    <button
                                        aria-pressed={active}
                                        className={`focus-ring rounded-full border px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors ${
                                            active
                                                ? "border-gold/70 bg-gold/10 text-gold"
                                                : "border-white/10 text-white/35 hover:border-white/25 hover:text-white/65"
                                        }`}
                                        data-value={phase}
                                        key={phase}
                                        onClick={handlePhaseToggle}
                                        type="button"
                                    >
                                        {phase}
                                    </button>
                                );
                            })}
                        </div>
                        {hasFilters ? (
                            <button
                                className="focus-ring font-mono text-[0.62rem] text-signal uppercase tracking-[0.15em] hover:text-white"
                                onClick={resetFilters}
                                type="button"
                            >
                                Reset filters
                            </button>
                        ) : null}
                    </div>
                </div>
            </section>

            <section
                className={`mx-auto scroll-mt-52 px-5 py-12 sm:px-8 lg:py-16 ${view === "orbit" ? "max-w-[1500px]" : "max-w-5xl"}`}
                id="timeline"
            >
                <div className="mb-10 flex items-center justify-between gap-5 border-white/10 border-b pb-5">
                    <div>
                        <p className="font-mono text-[0.65rem] text-white/35 uppercase tracking-[0.18em]">
                            Sacred timeline / Earth-616
                        </p>
                        <h2 className="mt-2 font-semibold text-2xl tracking-[-0.03em]">
                            {visibleEntries.length}{" "}
                            {visibleEntries.length === 1 ? "entry" : "entries"}
                        </h2>
                    </div>
                    <fieldset className="flex border border-white/10 p-1">
                        <legend className="sr-only">Timeline view</legend>
                        <button
                            aria-pressed={view === "timeline"}
                            className={`focus-ring px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors ${
                                view === "timeline" ? "bg-white/10 text-white" : "text-white/35"
                            }`}
                            data-view="timeline"
                            onClick={handleViewChange}
                            type="button"
                        >
                            2D timeline
                        </button>
                        <button
                            aria-pressed={view === "orbit"}
                            className={`focus-ring px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors ${
                                view === "orbit" ? "bg-signal/20 text-white" : "text-white/35"
                            }`}
                            data-view="orbit"
                            onClick={handleViewChange}
                            type="button"
                        >
                            3D orbit
                        </button>
                    </fieldset>
                </div>

                <AnimatePresence mode="wait">{timelineContent}</AnimatePresence>
            </section>

            <section
                className="border-white/10 border-t bg-white/[0.02] px-5 py-16 sm:px-8 lg:py-20"
                id="guide"
            >
                <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.7fr_1.3fr]">
                    <div>
                        <p className="font-mono text-gold text-xs uppercase tracking-[0.2em]">
                            Field guide
                        </p>
                        <h2 className="mt-3 font-semibold text-3xl tracking-[-0.04em]">
                            Reading the archive
                        </h2>
                    </div>
                    <div className="grid gap-6 text-white/52 leading-7 sm:grid-cols-2">
                        <p>
                            Entries follow story chronology, not release order. Some placements
                            cover a range when events unfold across multiple years.
                        </p>
                        <p>
                            Archive notes identify broad or uncertain placements. Filters are saved
                            in the URL, so any view can be bookmarked or shared.
                        </p>
                    </div>
                </div>
            </section>

            <footer className="border-white/10 border-t px-5 py-6 sm:px-8 lg:px-12">
                <div className="mx-auto flex max-w-[1500px] flex-wrap justify-between gap-3 font-mono text-[0.6rem] text-white/25 uppercase tracking-[0.16em]">
                    <span>MCU Chronoverse</span>
                    <span>Fan-made chronological archive</span>
                </div>
            </footer>

            <EntryDetail entry={selectedEntry} onClose={closeDetail} />
        </main>
    );
}
