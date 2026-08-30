import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    description:
        "Learn how MCU Chronoverse organises films, series, specials, shorts, and one-shots into one explorable story timeline.",
    title: "About the archive",
};

const principles = [
    {
        label: "Story first",
        text: "Entries follow in-universe chronology instead of release date, with broad placements marked honestly when the story leaves room for interpretation.",
    },
    {
        label: "One shared map",
        text: "Films, series, specials, shorts, and one-shots use the same data model and the same filters across both timeline views.",
    },
    {
        label: "Built to branch",
        text: "The archive starts with Earth-616, while its structure leaves room for alternate universes and branching histories later.",
    },
];

export default function AboutPage() {
    return (
        <main className="relative min-h-screen overflow-hidden">
            <div className="star-field" />
            <div className="grain" />
            <header className="border-white/10 border-b bg-void/82 backdrop-blur-xl">
                <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
                    <Link className="focus-ring inline-flex items-center gap-3" href="/">
                        <span className="grid size-9 place-items-center border border-signal/70 bg-signal/10 font-mono font-semibold text-signal text-xs">
                            616
                        </span>
                        <span className="font-semibold text-sm uppercase tracking-[0.23em]">
                            MCU <span className="text-white/45">Chronoverse</span>
                        </span>
                    </Link>
                    <Link
                        className="focus-ring font-mono text-muted text-xs uppercase tracking-[0.18em] transition-colors hover:text-ink"
                        href="/"
                    >
                        Return to timeline
                    </Link>
                </div>
            </header>

            <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
                <p className="flex items-center gap-3 font-mono text-gold text-xs uppercase tracking-[0.25em]">
                    <span className="h-px w-8 bg-gold/70" />
                    Archive protocol
                </p>
                <h1 className="mt-6 max-w-4xl text-balance font-semibold text-5xl leading-[0.96] tracking-[-0.055em] sm:text-7xl">
                    A clearer path through
                    <span className="block text-white/35">an expanding universe.</span>
                </h1>
                <p className="mt-8 max-w-2xl text-lg text-white/56 leading-8">
                    MCU Chronoverse is a fan-made chronological guide designed to make a sprawling
                    screen universe easier to explore, filter, and understand.
                </p>

                <div className="relative mt-14 overflow-hidden border border-white/10">
                    <Image
                        alt="A glowing red and gold chronology path through a dark cosmic archive"
                        className="h-auto w-full"
                        height={675}
                        priority
                        src="/og.png"
                        width={1200}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void/55 via-transparent to-transparent" />
                </div>

                <div className="mt-14 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
                    {principles.map((principle, index) => (
                        <article className="bg-[#0a0b0e] p-6 sm:p-8" key={principle.label}>
                            <p className="font-mono text-[0.62rem] text-signal uppercase tracking-[0.16em]">
                                Protocol 0{index + 1}
                            </p>
                            <h2 className="mt-8 font-semibold text-2xl tracking-[-0.03em]">
                                {principle.label}
                            </h2>
                            <p className="mt-4 text-white/48 leading-7">{principle.text}</p>
                        </article>
                    ))}
                </div>

                <div className="mt-16 border-white/10 border-t pt-10 text-sm text-white/43 leading-7">
                    <p className="max-w-3xl">
                        MCU Chronoverse is an independent fan project. It is not affiliated with or
                        endorsed by Marvel Entertainment or The Walt Disney Company. Titles and
                        related properties belong to their respective owners.
                    </p>
                </div>
            </section>
        </main>
    );
}
