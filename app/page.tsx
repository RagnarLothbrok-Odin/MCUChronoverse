const previewEvents = [
    { date: "1943", phase: "Phase One", title: "The First Avenger", type: "Film" },
    { date: "1995", phase: "Phase Three", title: "Captain Marvel", type: "Film" },
    { date: "2010", phase: "Phase One", title: "Iron Man", type: "Film" },
];

const previewOffsets = ["", "sm:-translate-y-10", "sm:translate-y-7"];

export default function Home() {
    return (
        <main className="relative min-h-screen overflow-hidden">
            <div className="star-field" />
            <div className="grain" />

            <header className="relative z-20 border-white/10 border-b bg-void/75 backdrop-blur-xl">
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
                        <span className="hidden h-4 w-px bg-white/15 sm:block" />
                        <span className="hidden font-mono text-[0.68rem] text-muted uppercase tracking-[0.18em] sm:block">
                            Archive online
                        </span>
                    </nav>
                </div>
            </header>

            <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1500px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-12 lg:py-20">
                <div className="relative z-10 max-w-2xl">
                    <p className="mb-6 flex items-center gap-3 font-mono text-gold text-xs uppercase tracking-[0.28em]">
                        <span className="h-px w-8 bg-gold/70" />
                        Chronological archive
                    </p>
                    <h1 className="text-balance font-semibold text-5xl leading-[0.94] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]">
                        The universe,
                        <span className="block text-white/38">in story order.</span>
                    </h1>
                    <p className="mt-7 max-w-xl text-base text-white/57 leading-7 sm:text-lg sm:leading-8">
                        Trace every film, series, special, and one-shot through one living timeline.
                        Filter the noise. Follow the story.
                    </p>
                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        <a
                            className="focus-ring inline-flex min-h-12 items-center border border-signal bg-signal px-6 font-semibold text-sm transition-colors hover:bg-[#ff3439]"
                            href="#timeline"
                        >
                            Enter the timeline
                        </a>
                        <span className="font-mono text-[0.7rem] text-muted uppercase tracking-[0.19em]">
                            Earth-616 / Sacred timeline
                        </span>
                    </div>
                </div>

                <div className="relative" id="timeline">
                    <div className="absolute top-1/2 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                    <div className="relative grid gap-5 sm:grid-cols-3 lg:gap-3">
                        {previewEvents.map((event, index) => (
                            <article
                                className={`relative border border-white/10 bg-black/30 p-5 backdrop-blur-md ${previewOffsets[index] ?? ""}`}
                                key={event.title}
                            >
                                <div className="mb-10 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.17em]">
                                    <span className="text-gold">{event.date}</span>
                                    <span className="text-white/35">0{index + 1}</span>
                                </div>
                                <p className="text-white/38 text-xs uppercase tracking-[0.16em]">
                                    {event.type}
                                </p>
                                <h2 className="mt-2 font-semibold text-lg tracking-tight">
                                    {event.title}
                                </h2>
                                <p className="mt-5 border-white/10 border-t pt-4 font-mono text-[0.63rem] text-white/35 uppercase tracking-[0.14em]">
                                    {event.phase}
                                </p>
                            </article>
                        ))}
                    </div>
                    <div className="mt-12 flex items-center justify-center gap-3 font-mono text-[0.65rem] text-white/35 uppercase tracking-[0.18em]">
                        <span className="size-1.5 rounded-full bg-signal shadow-[0_0_12px_var(--signal)]" />
                        Timeline systems initializing
                    </div>
                </div>
            </section>
        </main>
    );
}
