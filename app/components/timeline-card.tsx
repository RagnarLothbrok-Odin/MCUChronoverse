import type { TimelineEntry } from "../data/types";

const markerStyles: Record<TimelineEntry["contentType"], string> = {
    film: "border-signal/55 bg-signal",
    "one-shot": "border-violet-400/55 bg-violet-400",
    series: "border-sky-400/55 bg-sky-400",
    short: "border-emerald-400/55 bg-emerald-400",
    special: "border-gold/55 bg-gold",
};

const typeLabel: Record<TimelineEntry["contentType"], string> = {
    film: "Film",
    "one-shot": "One-Shot",
    series: "Series",
    short: "Short",
    special: "Special",
};

interface TimelineCardProps {
    entry: TimelineEntry;
    index: number;
    onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function TimelineCard({ entry, index, onSelect }: TimelineCardProps) {
    const position = index % 2 === 0 ? "md:pr-[calc(50%+2.75rem)]" : "md:pl-[calc(50%+2.75rem)]";
    const markerPosition =
        index % 2 === 0 ? "md:right-[calc(50%-0.42rem)]" : "md:left-[calc(50%-0.42rem)]";
    const [borderStyle, backgroundStyle] = markerStyles[entry.contentType].split(" ");

    return (
        <li className={`group relative pl-9 md:pl-0 ${position}`}>
            <span
                aria-hidden="true"
                className={`absolute top-8 left-[0.31rem] z-10 size-2.5 rounded-full border-2 border-void shadow-[0_0_0_4px_var(--void)] transition-transform duration-300 group-hover:scale-150 ${markerPosition} ${backgroundStyle}`}
            />
            <button
                className="focus-ring w-full border border-white/10 bg-surface/72 p-5 text-left backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.075] sm:p-6"
                data-slug={entry.slug}
                onClick={onSelect}
                type="button"
            >
                <span className="flex items-start justify-between gap-5">
                    <span>
                        <span
                            className={`inline-flex border-l-2 pl-2.5 font-mono text-[0.63rem] text-white/65 uppercase tracking-[0.18em] ${borderStyle}`}
                        >
                            {typeLabel[entry.contentType]}
                        </span>
                        <span className="mt-3 block font-semibold text-xl leading-tight tracking-[-0.025em] sm:text-2xl">
                            {entry.title}
                        </span>
                    </span>
                    <span className="shrink-0 font-mono text-[0.65rem] text-white/28 tracking-[0.15em]">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                </span>
                <span className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-white/10 border-t pt-4 font-mono text-[0.65rem] uppercase tracking-[0.13em]">
                    <span className="text-gold">{entry.placement}</span>
                    <span className="text-white/25">{entry.phase}</span>
                    <span className="text-white/25">{entry.runtime}</span>
                </span>
            </button>
        </li>
    );
}
