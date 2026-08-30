// biome-ignore-all lint/performance/noJsxPropsBind: Auth controls are intentionally scoped to this modal.

"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export function AuthMenu() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

    useEffect(() => {
        const openAuth = () => {
            setError(null);
            setOpen(true);
        };
        window.addEventListener("mcu-chronoverse:open-auth", openAuth);
        return () => window.removeEventListener("mcu-chronoverse:open-auth", openAuth);
    }, []);

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, []);

    async function handleOAuth() {
        setBusy(true);
        setError(null);
        setMessage(null);
        const { error: oauthError } = await createClient().auth.signInWithOAuth({
            options: { redirectTo: window.location.origin },
            provider: "discord",
        });
        if (oauthError) {
            setError("Discord sign-in is not available yet. Enable it in your Supabase providers.");
            setBusy(false);
        }
    }

    function handleBackdropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            setOpen(false);
        }
    }

    async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setMessage(null);
        const supabase = createClient();
        const result =
            mode === "sign-in"
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });
        if (result.error) {
            setError("Those details could not be authenticated. Check them and try again.");
        } else if (mode === "sign-up" && !result.data.session) {
            setMessage("Check your email to confirm your account, then sign in here.");
        } else {
            setOpen(false);
            setPassword("");
        }
        setBusy(false);
    }

    let emailSubmitLabel = "Create account with email";
    if (busy) {
        emailSubmitLabel = "Working...";
    } else if (mode === "sign-in") {
        emailSubmitLabel = "Sign in with email";
    }

    if (!open) {
        return null;
    }

    return (
        <div
            className="timeline-auth-modal-backdrop"
            onPointerDown={handleBackdropPointerDown}
            role="presentation"
        >
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
                    Sign in with Discord or email to carry your watch progress across devices. We
                    only store your account connection and the titles you mark watched.
                </p>
                {error ? <p className="timeline-auth-error">{error}</p> : null}
                {message ? <p className="timeline-auth-message">{message}</p> : null}
                <button
                    className="focus-ring timeline-auth-submit"
                    disabled={busy}
                    // biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth modal.
                    onClick={handleOAuth}
                    type="button"
                >
                    {busy ? "Opening Discord..." : "Continue with Discord"}
                </button>
                <div className="timeline-auth-divider">or use email</div>
                <form className="timeline-auth-form" onSubmit={handleEmailAuth}>
                    <label>
                        <span>Email</span>
                        <input
                            autoComplete="email"
                            onChange={(event) => setEmail(event.currentTarget.value)}
                            required
                            type="email"
                            value={email}
                        />
                    </label>
                    <label>
                        <span>Password</span>
                        <input
                            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                            minLength={8}
                            onChange={(event) => setPassword(event.currentTarget.value)}
                            required
                            type="password"
                            value={password}
                        />
                    </label>
                    <button
                        className="focus-ring timeline-auth-email-submit"
                        disabled={busy}
                        type="submit"
                    >
                        {emailSubmitLabel}
                    </button>
                </form>
                <button
                    className="focus-ring timeline-auth-switch"
                    onClick={() => {
                        setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                        setError(null);
                        setMessage(null);
                    }}
                    type="button"
                >
                    {mode === "sign-in"
                        ? "Need an account? Register with email"
                        : "Already registered? Sign in"}
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
