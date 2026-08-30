"use client";

import { AnimatePresence, motion } from "motion/react";
import type { MouseEventHandler, RefObject } from "react";
import type { TimelineEntry } from "../data/types";

interface WatchProgressMenuProps {
    accountActionLabel: string;
    accountReady: boolean;
    containerRef: RefObject<HTMLElement | null>;
    nextEntries: TimelineEntry[];
    onAccountAction: () => void | Promise<void>;
    onEntrySelect: MouseEventHandler<HTMLButtonElement>;
    onEntryToggle: MouseEventHandler<HTMLButtonElement>;
    onReset: () => void;
    onToggleOpen: () => void;
    open: boolean;
    pendingSlug: string | null;
    signedIn: boolean;
    syncError: boolean;
    totalWatchedCount: number;
    visibleEntryCount: number;
    visibleWatchedCount: number;
}

export function WatchProgressMenu({
    accountActionLabel,
    accountReady,
    containerRef,
    nextEntries,
    onAccountAction,
    onEntrySelect,
    onEntryToggle,
    onReset,
    onToggleOpen,
    open,
    pendingSlug,
    signedIn,
    syncError,
    totalWatchedCount,
    visibleEntryCount,
    visibleWatchedCount,
}: WatchProgressMenuProps) {
    const progress = visibleEntryCount
        ? `${(visibleWatchedCount / visibleEntryCount) * 100}%`
        : "0%";
    const resetDescription = totalWatchedCount
        ? `Clear ${totalWatchedCount} watched ${totalWatchedCount === 1 ? "item" : "items"}`
        : "Nothing marked yet";

    return (
        <aside
            className="absolute top-5 right-[4.5rem] z-50 sm:top-7 sm:right-[5.5rem]"
            ref={containerRef}
        >
            <button
                aria-controls="timeline-watchlist"
                aria-expanded={open}
                aria-label={open ? "Close watch progress" : "Open watch progress"}
                className="focus-ring timeline-watchlist-trigger"
                onClick={onToggleOpen}
                type="button"
            >
                <span className="timeline-watchlist-count">
                    <strong>{visibleWatchedCount}</strong>
                    <span>/ {visibleEntryCount}</span>
                </span>
                <span
                    aria-hidden="true"
                    className={`timeline-watchlist-chevron ${open ? "timeline-watchlist-chevron-open" : ""}`}
                >
                    ↓
                </span>
            </button>

            <AnimatePresence>
                {open ? (
                    <motion.div
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="timeline-watchlist-panel"
                        exit={{ opacity: 0, scale: 0.98, y: -8 }}
                        id="timeline-watchlist"
                        initial={{ opacity: 0, scale: 0.98, y: -8 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className="timeline-watchlist-heading">
                            <div>
                                <span>Watch progress</span>
                                <strong>
                                    {visibleWatchedCount} of {visibleEntryCount} complete
                                </strong>
                            </div>
                            <span aria-hidden="true">◒</span>
                        </div>
                        <div className="timeline-watchlist-progress">
                            <span style={{ width: progress }} />
                        </div>
                        <p className="timeline-watchlist-label">Up next in this view</p>
                        <div className="timeline-watchlist-tiles">
                            {nextEntries.length > 0 ? (
                                nextEntries.map((entry) => (
                                    <div
                                        className={`timeline-watchlist-tile-row ${pendingSlug === entry.slug ? "timeline-watchlist-tile-row-pending" : ""}`}
                                        key={entry.slug}
                                    >
                                        <button
                                            className="focus-ring timeline-watchlist-tile"
                                            data-slug={entry.slug}
                                            onClick={onEntrySelect}
                                            type="button"
                                        >
                                            <span className="timeline-watchlist-tile-copy">
                                                <span>{entry.contentType.replace("-", " ")}</span>
                                                <strong>{entry.title}</strong>
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className="timeline-watchlist-tile-arrow"
                                            >
                                                ↗
                                            </span>
                                        </button>
                                        <button
                                            aria-label={
                                                pendingSlug === entry.slug
                                                    ? `Undo marking ${entry.title} as watched`
                                                    : `Mark ${entry.title} as watched`
                                            }
                                            className="focus-ring timeline-watchlist-mark"
                                            data-pending={pendingSlug === entry.slug}
                                            data-slug={entry.slug}
                                            onClick={onEntryToggle}
                                            type="button"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className="timeline-watchlist-mark-icon"
                                            >
                                                {pendingSlug === entry.slug ? "↶" : "✓"}
                                            </span>
                                            <span>
                                                {pendingSlug === entry.slug ? "Undo" : "Mark"}
                                            </span>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="timeline-watchlist-empty">
                                    Everything in this view is watched.
                                </p>
                            )}
                        </div>
                        <button
                            className="focus-ring timeline-watchlist-reset"
                            disabled={totalWatchedCount === 0}
                            onClick={onReset}
                            type="button"
                        >
                            <span aria-hidden="true" className="timeline-watchlist-reset-icon">
                                ↺
                            </span>
                            <span className="timeline-watchlist-reset-copy">
                                <strong>Reset watch data</strong>
                                <small>{resetDescription}</small>
                            </span>
                        </button>
                        <button
                            className="focus-ring timeline-watchlist-account"
                            disabled={!accountReady}
                            onClick={onAccountAction}
                            type="button"
                        >
                            {accountActionLabel}
                        </button>
                        {signedIn && syncError ? (
                            <p className="timeline-watchlist-sync-error">
                                Sync paused. Your progress is still saved on this device.
                            </p>
                        ) : null}
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </aside>
    );
}
