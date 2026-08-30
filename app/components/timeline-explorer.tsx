"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
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

function toggleValue<T extends string>(values: T[], value: T): T[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isContentType(value: string | undefined): value is ContentType {
    return contentTypes.some((type) => type === value);
}

function isMcuPhase(value: string | undefined): value is McuPhase {
    return phases.some((phase) => phase === value);
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
    const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);

    useEffect(() => {
        setFilters(parseTimelineFilters(new URLSearchParams(searchString)));
    }, [searchString]);

    useEffect(() => {
        if (!filtersOpen) {
            return;
        }
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setFiltersOpen(false);
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [filtersOpen]);

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
    const activeFilterCount =
        filters.types.length + filters.phases.length + (filters.query ? 1 : 0);

    const toggleFilters = useCallback(() => setFiltersOpen((current) => !current), []);
    const closeDetail = useCallback(() => setSelectedEntry(null), []);
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
            setSelectedEntry(entries.find((entry) => entry.slug === slug) ?? null);
        },
        [entries]
    );

    const firstPlacement = visibleEntries[0]?.placement ?? "No origin";
    const lastPlacement = visibleEntries.at(-1)?.placement ?? "No destination";

    return (
        <main className="relative h-dvh min-h-[32rem] overflow-hidden bg-[#020203] text-ink">
            <div className="absolute inset-0">
                <TimelineOrbit
                    entries={visibleEntries}
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
                    <motion.aside
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute bottom-20 left-5 z-30 w-[min(30rem,calc(100%-2.5rem))] border border-white/14 bg-black/58 p-5 shadow-[0_20px_80px_rgb(0_0_0/55%)] backdrop-blur-2xl sm:bottom-24 sm:left-7 sm:p-6"
                        exit={{ opacity: 0, x: -16 }}
                        initial={{ opacity: 0, x: -16 }}
                        key={selectedEntry.slug}
                    >
                        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-[#ff8a3d] via-[#ffd28a] to-transparent" />
                        <div className="flex items-start justify-between gap-5">
                            <div>
                                <p className="font-mono text-[#ffb05e] text-[0.58rem] uppercase tracking-[0.17em]">
                                    {selectedEntry.placement} / {selectedEntry.contentType}
                                </p>
                                <h1 className="mt-3 font-semibold text-2xl leading-tight tracking-[-0.035em] sm:text-3xl">
                                    {selectedEntry.title}
                                </h1>
                            </div>
                            <button
                                aria-label="Close event details"
                                className="focus-ring grid size-9 shrink-0 place-items-center border border-white/12 text-white/40 hover:border-[#ff9b4a]/60 hover:text-white"
                                onClick={closeDetail}
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                        <p className="mt-4 line-clamp-3 text-sm text-white/52 leading-6">
                            {selectedEntry.description}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-white/10 border-t pt-4 font-mono text-[0.55rem] text-white/30 uppercase tracking-[0.12em]">
                            <span>{selectedEntry.phase}</span>
                            <span>{selectedEntry.runtime}</span>
                            <span>{selectedEntry.universe}</span>
                        </div>
                    </motion.aside>
                ) : (
                    <motion.div
                        animate={{ opacity: 1 }}
                        className="pointer-events-none absolute bottom-20 left-5 z-30 max-w-sm sm:bottom-24 sm:left-7"
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key="instructions"
                    >
                        <p className="font-mono text-[#ffad55] text-[0.58rem] uppercase tracking-[0.19em]">
                            Sacred timeline / Earth-616
                        </p>
                        <h1 className="mt-3 max-w-xs font-semibold text-3xl leading-[1.02] tracking-[-0.045em] sm:text-4xl">
                            The universe,
                            <span className="block text-white/38">in story order.</span>
                        </h1>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute right-5 bottom-5 left-5 z-30 sm:right-7 sm:bottom-7 sm:left-7">
                <div className="flex items-end justify-between gap-5 font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                    <span className="text-white/28">{firstPlacement}</span>
                    <div className="hidden flex-1 items-center gap-3 sm:flex">
                        <span className="h-px flex-1 bg-gradient-to-r from-[#ff8a3d]/25 via-[#ffb45c]/75 to-[#ff8a3d]/25" />
                        <span className="whitespace-nowrap text-white/28">
                            Drag to travel / Scroll to zoom
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-[#ff8a3d]/25 via-[#ffb45c]/75 to-[#ff8a3d]/25" />
                    </div>
                    <span className="text-right text-white/28">{lastPlacement}</span>
                </div>
            </div>
        </main>
    );
}
