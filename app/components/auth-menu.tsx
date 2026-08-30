"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type PendingAction = "discord" | "email" | null;

function describeEmailAuthError(message: string, mode: AuthMode) {
    const normalized = message.toLowerCase();
    if (normalized.includes("already registered") || normalized.includes("already exists")) {
        return "That email already has an account. Switch to sign in instead.";
    }
    if (normalized.includes("signup") && normalized.includes("disabled")) {
        return "New account registration is currently disabled.";
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

function emailActionLabel(mode: AuthMode, pending: boolean) {
    if (pending) {
        return mode === "sign-in" ? "Signing in..." : "Creating account...";
    }
    return mode === "sign-in" ? "Sign in with email" : "Create account with email";
}

export function AuthMenu() {
    const [open, setOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [callbackError, setCallbackError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [mode, setMode] = useState<AuthMode>("sign-in");
    const dialog = useRef<HTMLElement>(null);
    const initialFocus = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const busy = pendingAction !== null;

    const close = useCallback(() => {
        setOpen(false);
        setEmailError(null);
        setOauthError(null);
        setMessage(null);
        window.requestAnimationFrame(() => returnFocus.current?.focus());
    }, []);

    useEffect(() => {
        const openAuth = () => {
            returnFocus.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setEmailError(null);
            setOauthError(null);
            setCallbackError(null);
            setMessage(null);
            setMode("sign-in");
            setPassword("");
            setPasswordConfirmation("");
            setOpen(true);
            window.requestAnimationFrame(() => initialFocus.current?.focus());
        };
        window.addEventListener("mcu-chronoverse:open-auth", openAuth);
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("auth") === "failed") {
            currentUrl.searchParams.delete("auth");
            window.history.replaceState(null, "", currentUrl);
            setCallbackError("Your sign-in link could not be completed. Please try again.");
            setOpen(true);
            window.requestAnimationFrame(() => initialFocus.current?.focus());
        }
        return () => window.removeEventListener("mcu-chronoverse:open-auth", openAuth);
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                close();
                return;
            }
            if (event.key !== "Tab") {
                return;
            }
            const focusable = dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable || focusable.length === 0) {
                return;
            }
            const [first] = focusable;
            const last = focusable.item(focusable.length - 1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [close, open]);

    const handleOAuth = useCallback(async () => {
        setPendingAction("discord");
        setOauthError(null);
        setMessage(null);
        try {
            const { error } = await createClient().auth.signInWithOAuth({
                options: { redirectTo: `${window.location.origin}/auth/callback` },
                provider: "discord",
            });
            if (!error) {
                return;
            }
        } catch {
            // The same safe message covers network and provider failures.
        }
        setOauthError("Discord sign-in could not be started. Please try again.");
        setPendingAction(null);
    }, []);

    const handleBackdropPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
                close();
            }
        },
        [close]
    );

    const handleEmailAuth = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setEmailError(null);
            setMessage(null);
            if (mode === "sign-up" && password !== passwordConfirmation) {
                setEmailError("The passwords do not match.");
                return;
            }

            setPendingAction("email");
            try {
                const supabase = createClient();
                const result =
                    mode === "sign-in"
                        ? await supabase.auth.signInWithPassword({ email, password })
                        : await supabase.auth.signUp({
                              email,
                              options: {
                                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                              },
                              password,
                          });

                if (result.error) {
                    setEmailError(describeEmailAuthError(result.error.message, mode));
                } else if (mode === "sign-up" && !result.data.session) {
                    setMessage("Check your email to confirm your account, then sign in here.");
                    setPassword("");
                    setPasswordConfirmation("");
                } else {
                    setPassword("");
                    setPasswordConfirmation("");
                    close();
                }
            } catch {
                setEmailError("The authentication service could not be reached. Please try again.");
            } finally {
                setPendingAction(null);
            }
        },
        [close, email, mode, password, passwordConfirmation]
    );

    const toggleMode = useCallback(() => {
        setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
        setPassword("");
        setPasswordConfirmation("");
        setEmailError(null);
        setMessage(null);
    }, []);

    const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.currentTarget.value);
    }, []);

    const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(event.currentTarget.value);
    }, []);

    const handlePasswordConfirmationChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setPasswordConfirmation(event.currentTarget.value);
        },
        []
    );

    if (!open) {
        return null;
    }

    const emailSubmitLabel = emailActionLabel(mode, pendingAction === "email");

    return (
        <div
            className="timeline-auth-modal-backdrop"
            onPointerDown={handleBackdropPointerDown}
            role="presentation"
        >
            <section
                aria-describedby="timeline-auth-description"
                aria-labelledby="timeline-auth-title"
                aria-modal="true"
                className="timeline-auth-modal"
                ref={dialog}
                role="dialog"
            >
                <button
                    aria-label="Close sign-in dialog"
                    className="focus-ring timeline-auth-close"
                    onClick={close}
                    type="button"
                >
                    ×
                </button>
                <p className="timeline-auth-kicker">Archive account</p>
                <h2 id="timeline-auth-title">Keep your place in the timeline.</h2>
                <p className="timeline-auth-copy" id="timeline-auth-description">
                    Sign in with Discord or email to carry your watch progress across devices. We
                    only store your account connection and the titles you mark watched.
                </p>
                {callbackError ? (
                    <p className="timeline-auth-error" role="alert">
                        {callbackError}
                    </p>
                ) : null}
                <button
                    className="focus-ring timeline-auth-discord"
                    disabled={busy}
                    onClick={handleOAuth}
                    ref={initialFocus}
                    type="button"
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M19.54 5.32A16.2 16.2 0 0 0 15.5 4l-.5 1.03a14.4 14.4 0 0 0-6 0L8.5 4c-1.43.25-2.78.7-4.04 1.32C1.9 9.24 1.2 13.07 1.55 16.85a16.3 16.3 0 0 0 4.96 2.5l1.2-1.63c-.66-.24-1.3-.55-1.9-.9l.47-.36c3.66 1.7 7.62 1.7 11.23 0l.48.36c-.6.35-1.24.66-1.9.9l1.2 1.63a16.3 16.3 0 0 0 4.96-2.5c.4-4.38-.7-8.18-2.71-11.53ZM8.47 14.64c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Zm7.06 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Z" />
                    </svg>
                    <span>
                        {pendingAction === "discord"
                            ? "Opening Discord..."
                            : "Continue with Discord"}
                    </span>
                </button>
                {oauthError ? (
                    <p className="timeline-auth-error" role="alert">
                        {oauthError}
                    </p>
                ) : null}
                <div className="timeline-auth-divider">or use email</div>
                <form className="timeline-auth-form" onSubmit={handleEmailAuth}>
                    <label>
                        <span>Email</span>
                        <input
                            autoComplete="email"
                            disabled={busy}
                            onChange={handleEmailChange}
                            required
                            type="email"
                            value={email}
                        />
                    </label>
                    <label>
                        <span>Password</span>
                        <input
                            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                            disabled={busy}
                            minLength={mode === "sign-in" ? 6 : 8}
                            onChange={handlePasswordChange}
                            required
                            type="password"
                            value={password}
                        />
                    </label>
                    {mode === "sign-up" ? (
                        <label>
                            <span>Confirm password</span>
                            <input
                                autoComplete="new-password"
                                disabled={busy}
                                minLength={8}
                                onChange={handlePasswordConfirmationChange}
                                required
                                type="password"
                                value={passwordConfirmation}
                            />
                        </label>
                    ) : null}
                    <button
                        className="focus-ring timeline-auth-email-submit"
                        disabled={busy}
                        type="submit"
                    >
                        {emailSubmitLabel}
                    </button>
                </form>
                {emailError ? (
                    <p className="timeline-auth-error" role="alert">
                        {emailError}
                    </p>
                ) : null}
                {message ? (
                    <p aria-live="polite" className="timeline-auth-message">
                        {message}
                    </p>
                ) : null}
                <button
                    className="focus-ring timeline-auth-switch"
                    disabled={busy}
                    onClick={toggleMode}
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
