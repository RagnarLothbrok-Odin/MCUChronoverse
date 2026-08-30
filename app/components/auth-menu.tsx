// biome-ignore-all lint/performance/noJsxPropsBind: Auth controls are intentionally scoped to this modal.

"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

function describeEmailAuthError(message: string, mode: "sign-in" | "sign-up") {
    const normalized = message.toLowerCase();
    if (normalized.includes("already registered") || normalized.includes("already exists")) {
        return "That email already has an account. Switch to sign in instead.";
    }
    if (normalized.includes("signup") && normalized.includes("disabled")) {
        return "New account registration is disabled in Supabase. Enable Allow new users to sign up.";
    }
    if (normalized.includes("password") && normalized.includes("weak")) {
        return "That password is too weak. Use at least 8 characters with a less predictable phrase.";
    }
    if (normalized.includes("invalid login credentials")) {
        return "That email or password is incorrect.";
    }
    const fallback =
        mode === "sign-up"
            ? "This account could not be created. Check the details and try again."
            : "Those details could not be authenticated. Check them and try again.";
    return process.env.NODE_ENV === "development" ? `${fallback} (${message})` : fallback;
}

export function AuthMenu() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

    useEffect(() => {
        const openAuth = () => {
            setEmailError(null);
            setOauthError(null);
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
        setOauthError(null);
        setMessage(null);
        const { error: oauthSignInError } = await createClient().auth.signInWithOAuth({
            options: { redirectTo: `${window.location.origin}/auth/callback` },
            provider: "discord",
        });
        if (oauthSignInError) {
            setOauthError(
                "Discord sign-in is not available yet. Enable it in your Supabase providers."
            );
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
        setEmailError(null);
        setMessage(null);
        const supabase = createClient();
        const result =
            mode === "sign-in"
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({
                      email,
                      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                      password,
                  });
        if (result.error) {
            setEmailError(describeEmailAuthError(result.error.message, mode));
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
                <button
                    className="focus-ring timeline-auth-discord"
                    disabled={busy}
                    // biome-ignore lint/performance/noJsxPropsBind: This handler is local to the auth modal.
                    onClick={handleOAuth}
                    type="button"
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M19.54 5.32A16.2 16.2 0 0 0 15.5 4l-.5 1.03a14.4 14.4 0 0 0-6 0L8.5 4c-1.43.25-2.78.7-4.04 1.32C1.9 9.24 1.2 13.07 1.55 16.85a16.3 16.3 0 0 0 4.96 2.5l1.2-1.63c-.66-.24-1.3-.55-1.9-.9l.47-.36c3.66 1.7 7.62 1.7 11.23 0l.48.36c-.6.35-1.24.66-1.9.9l1.2 1.63a16.3 16.3 0 0 0 4.96-2.5c.4-4.38-.7-8.18-2.71-11.53ZM8.47 14.64c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Zm7.06 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Z" />
                    </svg>
                    <span>{busy ? "Opening Discord..." : "Continue with Discord"}</span>
                </button>
                {oauthError ? <p className="timeline-auth-error">{oauthError}</p> : null}
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
                {emailError ? <p className="timeline-auth-error">{emailError}</p> : null}
                {message ? <p className="timeline-auth-message">{message}</p> : null}
                <button
                    className="focus-ring timeline-auth-switch"
                    onClick={() => {
                        setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                        setEmailError(null);
                        setOauthError(null);
                        setMessage(null);
                    }}
                    type="button"
                >
                    {mode === "sign-in"
                        ? "Need an account? Register with email"
                        : "Already registered? Sign in"}
                </button>
            </section>
        </div>
    );
}
