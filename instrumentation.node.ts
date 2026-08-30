import { readFileSync } from "node:fs";
import { log } from "./app/lib/console";

const globalForBoot = globalThis as typeof globalThis & { __portalBooted?: boolean };

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version: string;
};

function runtimeLabel(): string {
    if (process.versions.bun) {
        return `Bun ${process.versions.bun} · ${process.platform} ${process.arch}`;
    }
    return `${process.version} · ${process.platform} ${process.arch}`;
}

function originUrl(): string {
    const port = process.env.PORT ?? "3000";
    return `http://localhost:${port}`;
}

export function registerNode(): void {
    if (globalForBoot.__portalBooted) {
        return;
    }
    globalForBoot.__portalBooted = true;

    const origin = originUrl();
    const heapMb = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);

    log.ready({
        boot: `${process.uptime().toFixed(2)}s`,
        heap: `${heapMb.toLocaleString("en")} MB`,
        name: "Portal",
        origin,
        pid: String(process.pid),
        runtime: runtimeLabel(),
        version: `v${pkg.version}`,
    });
}

export function logRequestError(
    error: { digest: string } & Error,
    request: {
        method: string;
        path: string;
    }
): void {
    log.error(`${request.method} ${request.path}`, error);
}

