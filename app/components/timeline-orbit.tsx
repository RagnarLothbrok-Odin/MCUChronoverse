"use client";

import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
    type MouseEvent as ReactMouseEvent,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import type { TimelineEntry } from "../data/types";
import { timelineNodePosition } from "../lib/timeline";

const nodeColours: Record<TimelineEntry["contentType"], string> = {
    film: "#e62429",
    "one-shot": "#c084fc",
    series: "#38bdf8",
    short: "#34d399",
    special: "#d6b46b",
};

interface TimelineOrbitProps {
    entries: readonly TimelineEntry[];
    onReturnToTimeline: () => void;
    onSelect: (slug: string) => void;
    selectedSlug?: string;
}

interface TimelineNodeProps {
    count: number;
    entry: TimelineEntry;
    index: number;
    onSelect: (slug: string) => void;
    selected: boolean;
}

function TimelineNode({ count, entry, index, onSelect, selected }: TimelineNodeProps) {
    const position = timelineNodePosition(index, count);
    const handleLabelClick = useCallback(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onSelect(entry.slug);
        },
        [entry.slug, onSelect]
    );

    return (
        <group position={[position.x, position.y, position.z]}>
            <mesh scale={selected ? 1.65 : 1}>
                <sphereGeometry args={[0.14, 24, 24]} />
                <meshStandardMaterial
                    color={nodeColours[entry.contentType]}
                    emissive={nodeColours[entry.contentType]}
                    emissiveIntensity={selected ? 3.5 : 1.7}
                    roughness={0.28}
                />
            </mesh>
            <Html center distanceFactor={11} position={[0, 0.34, 0]}>
                <button
                    className={`orbit-label ${selected ? "orbit-label-selected" : ""}`}
                    onClick={handleLabelClick}
                    type="button"
                >
                    <span>{entry.placement}</span>
                    {entry.title}
                </button>
            </Html>
        </group>
    );
}

interface OrbitSceneProps {
    entries: readonly TimelineEntry[];
    onSelect: (slug: string) => void;
    reducedMotion: boolean;
    selectedSlug?: string;
}

function OrbitScene({ entries, onSelect, reducedMotion, selectedSlug }: OrbitSceneProps) {
    const curve = useMemo(() => {
        const points = entries.map((_, index) => {
            const position = timelineNodePosition(index, entries.length);
            return new Vector3(position.x, position.y, position.z);
        });
        if (points.length === 1) {
            points.push(points[0]?.clone().add(new Vector3(0, 0.001, 0)) ?? new Vector3());
        }
        return new CatmullRomCurve3(points, false, "catmullrom", 0.45);
    }, [entries]);

    return (
        <>
            <ambientLight intensity={0.65} />
            <pointLight color="#e62429" intensity={22} position={[4, 4, 6]} />
            <pointLight color="#4d6fff" intensity={16} position={[-5, -3, 2]} />
            <Stars
                count={1100}
                depth={32}
                factor={2.2}
                fade
                radius={45}
                speed={reducedMotion ? 0 : 0.15}
            />
            <mesh>
                <tubeGeometry args={[curve, 160, 0.025, 8, false]} />
                <meshBasicMaterial color="#e8d7b0" opacity={0.34} transparent />
            </mesh>
            {entries.map((entry, index) => (
                <TimelineNode
                    count={entries.length}
                    entry={entry}
                    index={index}
                    key={entry.slug}
                    onSelect={onSelect}
                    selected={selectedSlug === entry.slug}
                />
            ))}
            <OrbitControls
                autoRotate={!reducedMotion}
                autoRotateSpeed={0.22}
                dampingFactor={0.055}
                enableDamping
                enablePan={false}
                maxDistance={19}
                minDistance={7}
            />
        </>
    );
}

function supportsWebGl(): boolean {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

export function TimelineOrbit({
    entries,
    onReturnToTimeline,
    onSelect,
    selectedSlug,
}: TimelineOrbitProps) {
    const [webGlSupported, setWebGlSupported] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        setWebGlSupported(supportsWebGl());
        setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, []);

    if (!webGlSupported) {
        return (
            <div className="grid min-h-[34rem] place-items-center border border-white/10 bg-white/[0.025] p-8 text-center">
                <div className="max-w-md">
                    <p className="font-mono text-gold text-xs uppercase tracking-[0.2em]">
                        Spatial mode unavailable
                    </p>
                    <h2 className="mt-4 font-semibold text-3xl tracking-[-0.04em]">
                        This device cannot open the 3D archive.
                    </h2>
                    <p className="mt-4 text-white/48 leading-7">
                        The complete chronology is still available in the accessible timeline view.
                    </p>
                    <button
                        className="focus-ring mt-7 border border-white/15 px-5 py-2.5 text-sm hover:border-signal"
                        onClick={onReturnToTimeline}
                        type="button"
                    >
                        Open 2D timeline
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-[min(72vh,48rem)] min-h-[34rem] overflow-hidden border border-white/10 bg-black/35">
            <div className="pointer-events-none absolute top-5 left-5 z-10 max-w-xs">
                <p className="font-mono text-[0.62rem] text-gold uppercase tracking-[0.18em]">
                    Spatial navigation
                </p>
                <p className="mt-2 text-white/38 text-xs leading-5">
                    Drag to orbit. Scroll to zoom. Select any node to open its archive record.
                </p>
            </div>
            <Canvas camera={{ fov: 48, position: [0, 0, 13] }} dpr={[1, 1.5]}>
                <Suspense fallback={null}>
                    <OrbitScene
                        entries={entries}
                        onSelect={onSelect}
                        reducedMotion={reducedMotion}
                        selectedSlug={selectedSlug}
                    />
                </Suspense>
            </Canvas>
            <div className="pointer-events-none absolute right-5 bottom-5 left-5 flex justify-between font-mono text-[0.58rem] text-white/27 uppercase tracking-[0.14em]">
                <span>{entries.length} active nodes</span>
                <span>{reducedMotion ? "Static orbit" : "Live orbit"}</span>
            </div>
        </div>
    );
}
