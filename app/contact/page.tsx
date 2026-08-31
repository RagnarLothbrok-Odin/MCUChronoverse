import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "../components/contact-form";
import { chronology } from "../data/chronology";

const developmentTurnstileSiteKey = "1x00000000000000000000AA";

export const metadata: Metadata = {
    description:
        "Suggest timeline corrections, missing entries, date updates, and improvements for MCU Chronoverse.",
    title: "Contact the archive",
};

export default function ContactPage() {
    const turnstileSiteKey =
        process.env.NODE_ENV === "production"
            ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            : developmentTurnstileSiteKey;
    if (!turnstileSiteKey) {
        throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required in production");
    }

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

            <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
                <p className="flex items-center gap-3 font-mono text-gold text-xs uppercase tracking-[0.25em]">
                    <span className="h-px w-8 bg-gold/70" />
                    Archive corrections
                </p>
                <h1 className="mt-6 text-balance font-semibold text-5xl leading-[0.96] tracking-[-0.055em] sm:text-7xl">
                    Spotted something
                    <span className="block text-white/35">out of time?</span>
                </h1>
                <p className="mt-8 max-w-2xl text-lg text-white/56 leading-8">
                    Send a correction for an incorrect year, disputed placement, missing title, or
                    anything else that could make the archive better.
                </p>

                <div className="mt-12 border border-white/10 bg-[#0a0b0e]/88 p-5 backdrop-blur-xl sm:p-8">
                    <ContactForm
                        entries={chronology.map(
                            ({ contentType, placement, posterUrl, slug, title }) => ({
                                contentType,
                                placement,
                                posterUrl,
                                slug,
                                title,
                            })
                        )}
                        turnstileSiteKey={turnstileSiteKey}
                    />
                </div>
            </section>
        </main>
    );
}
