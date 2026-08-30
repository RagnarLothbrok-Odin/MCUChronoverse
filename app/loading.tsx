export default function Loading() {
    return (
        <main className="grid min-h-screen place-items-center bg-void text-ink">
            <div className="text-center">
                <span className="mx-auto block size-2 animate-pulse rounded-full bg-signal shadow-[0_0_18px_var(--signal)]" />
                <p className="mt-5 font-mono text-muted text-xs uppercase tracking-[0.24em]">
                    Aligning timeline
                </p>
            </div>
        </main>
    );
}
