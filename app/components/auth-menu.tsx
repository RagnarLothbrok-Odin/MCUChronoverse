"use client";

// Form handlers stay local to this small client island so auth credentials never enter shared app state.
// biome-ignore-all lint/performance/noJsxPropsBind: Local form handlers are intentionally scoped to this auth island.
// biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: The authenticated and signed-out views share one compact menu.

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The authenticated and signed-out views share one compact menu.
export function AuthMenu() {
    const [user, setUser] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user));
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const openAuth = () => setOpen(true);
        window.addEventListener("mcu-chronoverse:open-auth", openAuth);
        return () => window.removeEventListener("mcu-chronoverse:open-auth", openAuth);
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setMessage(null);
        const supabase = createClient();
        const result = await supabase.auth.signInWithPassword({ email, password });

        if (result.error) {
            setError("That account could not be authenticated. Check your details and try again.");
        } else {
            setMessage("Your watch progress will now sync across devices.");
            setPassword("");
        }
        setBusy(false);
    }

    async function handleOAuth() {
        setBusy(true);
        setError(null);
        const { error: oauthError } = await createClient().auth.signInWithOAuth({
            options: { redirectTo: window.location.origin },
            provider: "google",
        });
        if (oauthError) {
            setError("Google sign-in is not available yet. Enable it in your Supabase providers.");
            setBusy(false);
        }
    }

    async function handleSignOut() {
        setError(null);
        setMessage(null);
        const { error: signOutError } = await createClient().auth.signOut();
        if (signOutError) {
            setError("You could not be signed out. Please try again.");
        } else {
            setOpen(false);
            setMessage("Signed out. This device can still keep local progress.");
        }
    }

    let submitLabel = "Sign in";
    if (busy) {
        submitLabel = "Working...";
    }

    return (
        <aside className="timeline-auth" data-timeline-auth="true">
            <button
                aria-expanded={open}
                aria-label={user ? "Open account menu" : "Open account sign-in"}
                className="focus-ring timeline-auth-trigger"
                // biome-ignore lint/performance/noJsxPropsBind: The toggle needs the current menu state.
                onClick={() => {
                    setOpen((current) => !current);
                    setError(null);
                }}
                type="button"
            >
                <span aria-hidden="true" className="timeline-auth-glyph">
                    {user ? "◉" : "○"}
                </span>
                <span>{user ? "Account" : "Sync progress"}</span>
            </button>

            {open ? (
                <div className="timeline-auth-panel">
                    {user ? (
                        <>
                            <p className="timeline-auth-kicker">Archive account</p>
                            <p className="timeline-auth-email">{user.email}</p>
                            <p className="timeline-auth-copy">
                                Your watched titles sync securely across your signed-in devices.
                            </p>
                            <button
                                className="focus-ring timeline-auth-submit"
                                // biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth island.
                                onClick={handleSignOut}
                                type="button"
                            >
                                Sign out
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="timeline-auth-kicker">Sync your archive</p>
                            <p className="timeline-auth-copy">
                                Sign in to keep watch progress available across devices. Nothing
                                beyond your account and watch status is stored.
                            </p>
                            {/* biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth island. */}
                            <form className="timeline-auth-form" onSubmit={handleSubmit}>
                                <label>
                                    <span>Email</span>
                                    <input
                                        autoComplete="email"
                                        // biome-ignore lint/performance/noJsxPropsBind: This input remains local to the auth form.
                                        onChange={(event) => setEmail(event.currentTarget.value)}
                                        required
                                        type="email"
                                        value={email}
                                    />
                                </label>
                                <label>
                                    <span>Password</span>
                                    <input
                                        autoComplete="current-password"
                                        minLength={8}
                                        // biome-ignore lint/performance/noJsxPropsBind: This input remains local to the auth form.
                                        onChange={(event) => setPassword(event.currentTarget.value)}
                                        required
                                        type="password"
                                        value={password}
                                    />
                                </label>
                                {error ? <p className="timeline-auth-error">{error}</p> : null}
                                {message ? (
                                    <p className="timeline-auth-message">{message}</p>
                                ) : null}
                                <button
                                    className="focus-ring timeline-auth-submit"
                                    disabled={busy}
                                    type="submit"
                                >
                                    {submitLabel}
                                </button>
                            </form>
                            <button
                                className="focus-ring timeline-auth-oauth"
                                disabled={busy}
                                // biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth island.
                                onClick={handleOAuth}
                                type="button"
                            >
                                Continue with Google
                            </button>
                            <button
                                className="focus-ring timeline-auth-switch"
                                // biome-ignore lint/performance/noJsxPropsBind: This handler only closes the local menu.
                                onClick={() => setOpen(false)}
                                type="button"
                            >
                                Keep browsing without an account
                            </button>
                        </>
                    )}
                </div>
            ) : null}
        </aside>
    );
}
