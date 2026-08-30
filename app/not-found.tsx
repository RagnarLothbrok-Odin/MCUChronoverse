import Link from "next/link";

export default function NotFound() {
    return (
        <main className="grid min-h-screen place-items-center px-6 text-center">
            <div>
                <p className="font-mono text-signal text-xs uppercase tracking-[0.28em]">
                    Timeline divergence / 404
                </p>
                <h1 className="mt-5 font-semibold text-5xl tracking-[-0.05em]">
                    This branch does not exist.
                </h1>
                <p className="mx-auto mt-5 max-w-md text-muted leading-7">
                    Return to the sacred timeline and continue exploring the Chronoverse.
                </p>
                <Link
                    className="focus-ring mt-8 inline-flex border border-white/15 px-6 py-3 font-semibold text-sm transition-colors hover:border-signal hover:text-signal"
                    href="/"
                >
                    Return to timeline
                </Link>
            </div>
        </main>
    );
}
