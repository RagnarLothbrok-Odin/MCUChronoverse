"use client";

import Script from "next/script";

interface TurnstileApi {
    reset: (widgetId?: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

interface TurnstileWidgetProps {
    siteKey: string;
}

export function resetContactTurnstile(): void {
    window.turnstile?.reset();
}

export function TurnstileWidget({ siteKey }: TurnstileWidgetProps) {
    return (
        <>
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="afterInteractive"
            />
            <div
                className="cf-turnstile contact-turnstile"
                data-action="contact_submission"
                data-sitekey={siteKey}
                data-size="normal"
                data-theme="dark"
            />
        </>
    );
}
