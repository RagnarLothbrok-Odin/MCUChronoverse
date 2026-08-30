"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export function AuthMenu() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const openAuth = () => {
            setError(null);
            setOpen(true);
        };
        window.addEventListener("mcu-chronoverse:open-auth", openAuth);
        return () => window.removeEventListener("mcu-chronoverse:open-auth", openAuth);
    }, []);

    async function handleOAuth() {
        setBusy(true);
        setError(null);
        const { error: oauthError } = await createClient().auth.signInWithOAuth({
            options: { redirectTo: window.location.origin },
            provider: "discord",
        });
        if (oauthError) {
            setError("Discord sign-in is not available yet. Enable it in your Supabase providers.");
            setBusy(false);
        }
    }

    if (!open) {
        return null;
    }

    return (
        <div className="timeline-auth-modal-backdrop" role="presentation">
            <section
                aria-labelledby="timeline-auth-title"
                aria-modal="true"
                className="timeline-auth-modal"
                role="dialog"
            >
                <button
                    aria-label="Close sign-in dialog"
                    className="focus-ring timeline-auth-close"
                    // biome-ignore lint/performance/noJsxPropsBind: This closes the local modal.
                    onClick={() => setOpen(false)}
                    type="button"
                >
                    ×
                </button>
                <p className="timeline-auth-kicker">Archive account</p>
                <h2 id="timeline-auth-title">Keep your place in the timeline.</h2>
                <p className="timeline-auth-copy">
                    Sign in with Discord to carry your watch progress across devices. We only store
                    your account connection and the titles you mark watched.
                </p>
                {error ? <p className="timeline-auth-error">{error}</p> : null}
                <button
                    className="focus-ring timeline-auth-submit"
                    disabled={busy}
                    // biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth modal.
                    onClick={handleOAuth}
                    type="button"
                >
                    {busy ? "Opening Discord..." : "Continue with Discord"}
                </button>
                <button
                    className="focus-ring timeline-auth-switch"
                    // biome-ignore lint/performance/noJsxPropsBind: This closes the local modal.
                    onClick={() => setOpen(false)}
                    type="button"
                >
                    Not now
                </button>
            </section>
        </div>
    );
}
