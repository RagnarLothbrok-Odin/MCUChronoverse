"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
    return (
        <main className="grid min-h-screen place-items-center px-6 text-center">
            <div>
                <p className="font-mono text-signal text-xs uppercase tracking-[0.28em]">
                    Temporal anomaly
                </p>
                <h1 className="mt-5 font-semibold text-5xl tracking-tighter">
                    The timeline destabilized.
                </h1>
                <p className="mx-auto mt-5 max-w-md text-muted leading-7">
                    The archive encountered an unexpected branch. Try restoring the current view.
                </p>
                <button
                    className="focus-ring mt-8 border border-white/15 px-6 py-3 font-semibold text-sm transition-colors hover:border-signal hover:text-signal"
                    onClick={reset}
                    type="button"
                >
                    Restore timeline
                </button>
            </div>
        </main>
    );
}
