"use client";

import { useEffect, useRef } from "react";
import type { TimelineEntry } from "../data/types";

interface EntryDetailProps {
    entry: TimelineEntry | null;
    onClose: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
});

export function EntryDetail({ entry, onClose }: EntryDetailProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null || entry === null) {
            return;
        }
        dialog.showModal();
        return () => dialog.close();
    }, [entry]);

    if (!entry) {
        return null;
    }

    return (
        <dialog
            aria-labelledby="entry-detail-title"
            className="m-auto w-[min(42rem,calc(100%-2rem))] border border-white/15 bg-[#0b0c0f]/98 p-0 text-ink shadow-[0_30px_120px_rgb(0_0_0/75%)] backdrop:bg-black/75 backdrop:backdrop-blur-sm"
            onCancel={onClose}
            onClose={onClose}
            ref={dialogRef}
        >
            <div className="relative overflow-hidden p-6 sm:p-9">
                <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-signal to-transparent" />
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <p className="font-mono text-gold text-xs uppercase tracking-[0.22em]">
                            {entry.placement} / {entry.universe}
                        </p>
                        <h2
                            className="mt-4 max-w-xl font-semibold text-3xl leading-tight tracking-[-0.04em] sm:text-4xl"
                            id="entry-detail-title"
                        >
                            {entry.title}
                        </h2>
                    </div>
                    <button
                        aria-label="Close details"
                        className="focus-ring grid size-10 shrink-0 place-items-center border border-white/15 font-mono text-lg text-white/55 transition-colors hover:border-signal hover:text-white"
                        onClick={onClose}
                        type="button"
                    >
                        ×
                    </button>
                </div>
                <p className="mt-7 text-base text-white/68 leading-7 sm:text-lg sm:leading-8">
                    {entry.description}
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-4">
                    {[
                        ["Format", entry.contentType.replace("-", " ")],
                        ["Phase", entry.phase],
                        [
                            "Released",
                            dateFormatter.format(new Date(`${entry.releaseDate}T00:00:00`)),
                        ],
                        ["Runtime", entry.runtime],
                    ].map(([label, value]) => (
                        <div className="bg-[#0b0c0f] p-4" key={label}>
                            <dt className="font-mono text-[0.6rem] text-white/35 uppercase tracking-[0.17em]">
                                {label}
                            </dt>
                            <dd className="mt-2 text-sm capitalize">{value}</dd>
                        </div>
                    ))}
                </dl>
                {entry.note ? (
                    <p className="mt-6 border-gold/35 border-l-2 pl-4 text-sm text-white/48 leading-6">
                        <span className="font-semibold text-gold">Archive note: </span>
                        {entry.note}
                    </p>
                ) : null}
            </div>
        </dialog>
    );
}
